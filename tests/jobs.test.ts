import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPANIES, combineFeeds, deduplicateJobs, filterJobs, isRelevantRole, normalizeFeed, relativeDate } from "../src/lib/jobs.ts";

// Synthetic fixtures are used only in tests, never in the live website.
const now = new Date("2026-11-19T12:00:00.000Z");
const company = COMPANIES[0];
const posting = {
  title: "Applied AI Engineer", isListed: true,
  location: "San Francisco", secondaryLocations: [{ location: "New York" }, { location: "San Francisco" }],
  workplaceType: "Hybrid", isRemote: true,
  publishedAt: "2026-11-18T08:00:00.000Z",
  jobUrl: "https://jobs.ashbyhq.com/openai/test-position",
  applyUrl: "https://jobs.ashbyhq.com/openai/test-position/apply",
  descriptionPlain: "Build AI applications with our customers.",
};

test("configured company and board identities are unique and domains are valid", () => {
  assert.equal(new Set(COMPANIES.map(company => company.id)).size, COMPANIES.length);
  assert.equal(new Set(COMPANIES.map(company => company.board.toLowerCase())).size, COMPANIES.length);
  for (const company of COMPANIES) {
    assert.ok(company.name.trim());
    assert.match(company.id, /^[a-z0-9-]+$/);
    assert.equal(new URL(`https://${company.domain}`).hostname, company.domain);
    assert.equal(new URL(`https://${company.domain}`).pathname, "/");
  }
});

test("remote listings preserve regional restrictions without admitting hybrid jobs", () => {
  const feed = normalizeFeed({ jobs: [{ ...posting, location: "Europe", secondaryLocations: [{ location: "United Kingdom" }, { location: "Ireland" }], workplaceType: "Remote" }, { ...posting, jobUrl: `${posting.jobUrl}-hybrid`, workplaceType: "Hybrid" }] }, company, now);
  const remoteJobs = filterJobs(feed.jobs, "", true, []);
  assert.equal(remoteJobs.length, 1);
  assert.deepEqual(remoteJobs[0].locations, ["Europe", "United Kingdom", "Ireland"]);
  assert.equal(filterJobs(remoteJobs, "Ireland", true, []).length, 1);
});

test("AI/LLM application engineering roles are included", () => {
  for (const title of ["AI Engineer", "Applied AI Engineering Manager", "LLM Application Developer", "Software Engineer, Agents", "Senior Generative AI Engineer", "AI Solutions Engineer", "Agentic AI Engineer"]) {
    assert.equal(isRelevantRole(title), true, title);
  }
});

test("unrelated, research, training and infrastructure roles are excluded", () => {
  for (const title of ["Product Designer, AI", "Software Engineer", "Research Scientist", "Research Engineer, LLM", "AI Infrastructure Engineer", "Software Engineer, Agent Infrastructure", "LLM Inference Engineer", "Post-Training AI Engineer", "AI Sales Engineer", "AI Support Engineer", "GPU Engineer", "Design Engineer", "AI Security Engineer"]) {
    assert.equal(isRelevantRole(title), false, title);
  }
});

test("generic applied and product engineering needs explicit application-building evidence", () => {
  assert.equal(isRelevantRole("Forward Deployed Engineer", "We are an AI company."), false);
  assert.equal(isRelevantRole("Forward Deployed Engineer", "You will build AI applications for our customers."), true);
  assert.equal(isRelevantRole("Product Engineer", "Develop and ship LLM-powered customer workflows."), true);
  assert.equal(isRelevantRole("Backend Engineer", "We build AI applications."), false);
});

test("engineering department names and agent infrastructure do not admit unrelated roles", () => {
  const context = "Build AI applications for customers.";
  for (const title of ["Product Manager, Financial Engineering", "Technical Program Manager — Applied AI Engineering", "Software Engineer, Agent Infra", "Software Engineer, AI Accelerator Runtime", "Machine Learning Engineer, Search Agent RL"]) {
    assert.equal(isRelevantRole(title, context), false, title);
  }
});

test("normalization keeps real dates, application URLs and unique locations", () => {
  const feed = normalizeFeed({ jobs: [posting] }, company, now);
  assert.equal(feed.jobs.length, 1);
  assert.deepEqual(feed.jobs[0].locations, ["San Francisco", "New York"]);
  assert.equal(feed.jobs[0].publishedAt, posting.publishedAt);
  assert.equal(feed.jobs[0].applyUrl, posting.applyUrl);
  assert.equal(feed.fetchedAt, now.toISOString());
});

test("only explicitly listed openings are public", () => {
  assert.equal(normalizeFeed({ jobs: [{ ...posting, isListed: false }, { ...posting, isListed: undefined }] }, company, now).jobs.length, 0);
});

test("hybrid is never classified as fully remote by the permissive isRemote flag", () => {
  const jobs = normalizeFeed({ jobs: [posting] }, company, now).jobs;
  assert.equal(jobs[0].workplace, "Hybrid");
  assert.equal(filterJobs(jobs, "", true, []).length, 0);
  const unknown = normalizeFeed({ jobs: [{ ...posting, workplaceType: null }] }, company, now).jobs;
  assert.equal(filterJobs(unknown, "", true, []).length, 0);
});

test("unknown, invalid and implausible future publication dates are not fabricated", () => {
  for (const publishedAt of [undefined, "invalid", "2030-01-01T00:00:00Z"]) {
    assert.equal(normalizeFeed({ jobs: [{ ...posting, publishedAt }] }, company, now).jobs[0].publishedAt, null);
  }
});

test("unsafe or unrelated job links are rejected; valid source URL is an apply fallback", () => {
  for (const jobUrl of ["javascript:alert(1)", "http://jobs.ashbyhq.com/test", "https://evil.example/job", "https://user:secret@jobs.ashbyhq.com/job"]) {
    assert.equal(normalizeFeed({ jobs: [{ ...posting, jobUrl }] }, company, now).jobs.length, 0);
  }
  const jobs = normalizeFeed({ jobs: [{ ...posting, applyUrl: "https://evil.example/job" }] }, company, now).jobs;
  assert.equal(jobs[0].applyUrl, posting.jobUrl);
});

test("duplicate postings are removed without merging different companies", () => {
  const job = normalizeFeed({ jobs: [posting] }, company, now).jobs[0];
  assert.equal(deduplicateJobs([job, { ...job, sourceUrl: `${job.sourceUrl}?ref=test` }]).length, 1);
  assert.equal(deduplicateJobs([job, { ...job, companyId: "different" }]).length, 2);
});

test("search, remote-only and multi-company selection combine", () => {
  const job = normalizeFeed({ jobs: [{ ...posting, workplaceType: "Remote" }] }, company, now).jobs[0];
  const second = { ...job, id: "second", companyId: "other", company: "Another company", title: "Agent Developer", workplace: "Hybrid" as const };
  assert.equal(filterJobs([job, second], "AI New York", true, [company.id]).length, 1);
  assert.equal(filterJobs([job, second], "AI", true, ["other"]).length, 0);
  assert.equal(filterJobs([job, second], "  new   YORK ", false, [company.id, "other"]).length, 2);
  assert.equal(filterJobs([job], "no-match", false, []).length, 0);
});

test("feeds sort newest first and unknown dates last", () => {
  const feed = normalizeFeed({ jobs: [posting] }, company, now);
  feed.jobs.push({ ...feed.jobs[0], id: "new", sourceUrl: `${posting.jobUrl}-new`, publishedAt: now.toISOString() });
  feed.jobs.push({ ...feed.jobs[0], id: "unknown", sourceUrl: `${posting.jobUrl}-unknown`, publishedAt: null });
  const result = combineFeeds([{ status: "fulfilled", value: feed }], now);
  assert.equal(result.jobs[0].id, "new");
  assert.equal(result.jobs.at(-1)?.id, "unknown");
});

test("one failed feed does not discard successful feeds", () => {
  const feed = normalizeFeed({ jobs: [posting] }, company, now);
  const result = combineFeeds([{ status: "fulfilled", value: feed }, { status: "rejected", reason: new Error("Timeout") }], now);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.unavailableSources, 1);
  assert.equal(result.totalSources, 2);
  assert.equal(result.updatedAt, now.toISOString());
});

test("cached old snapshots remain usable but are labeled stale", () => {
  const feed = normalizeFeed({ jobs: [posting] }, company, new Date("2026-11-18T12:00:00Z"));
  const result = combineFeeds([{ status: "fulfilled", value: feed }], now);
  assert.equal(result.stale, true);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.updatedAt, feed.fetchedAt);
});

test("all failed feeds are distinct from successful empty feeds", () => {
  assert.equal(combineFeeds([{ status: "rejected", reason: new Error("offline") }], now).updatedAt, null);
  assert.equal(combineFeeds([{ status: "fulfilled", value: normalizeFeed({ jobs: [] }, company, now) }], now).updatedAt, now.toISOString());
});

test("malformed provider responses throw instead of replacing a good cached snapshot", () => {
  for (const payload of [null, {}, { jobs: "bad" }]) assert.throws(() => normalizeFeed(payload, company, now));
  assert.equal(normalizeFeed({ jobs: [null, 3, {}, posting] }, company, now).jobs.length, 1);
});

test("relative dates distinguish today, yesterday, weeks and missing dates", () => {
  assert.equal(relativeDate(now.toISOString(), now), "Today");
  assert.equal(relativeDate("2026-11-18T12:00:00Z", now), "Yesterday");
  assert.equal(relativeDate("2026-11-16T12:00:00Z", now), "3d ago");
  assert.equal(relativeDate("2026-11-10T12:00:00Z", now), "1w ago");
  assert.equal(relativeDate("2026-09-10T12:00:00Z", now), "5w+ ago");
  assert.equal(relativeDate(null, now), "—");
});
