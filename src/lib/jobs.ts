export type Workplace = "Remote" | "Hybrid" | "OnSite" | "Unknown";

export interface Company {
  id: string;
  name: string;
  board: string;
  domain: string;
}

export interface Job {
  id: string;
  companyId: string;
  company: string;
  domain: string;
  title: string;
  locations: string[];
  workplace: Workplace;
  publishedAt: string | null;
  applyUrl: string;
  sourceUrl: string;
}

export interface FeedSnapshot {
  company: Company;
  jobs: Job[];
  fetchedAt: string;
}

export interface JobsData {
  jobs: Job[];
  updatedAt: string | null;
  stale: boolean;
  unavailableSources: number;
  totalSources: number;
}

export const COMPANIES: Company[] = [
  { id: "openai", name: "OpenAI", board: "openai", domain: "openai.com" },
  { id: "perplexity", name: "Perplexity", board: "Perplexity", domain: "perplexity.ai" },
  { id: "cohere", name: "Cohere", board: "cohere", domain: "cohere.com" },
  { id: "langchain", name: "LangChain", board: "langchain", domain: "langchain.com" },
  { id: "harvey", name: "Harvey", board: "harvey", domain: "harvey.ai" },
  { id: "elevenlabs", name: "ElevenLabs", board: "elevenlabs", domain: "elevenlabs.io" },
  { id: "sierra", name: "Sierra", board: "sierra", domain: "sierra.ai" },
  { id: "writer", name: "Writer", board: "WRITER", domain: "writer.com" },
  { id: "replit", name: "Replit", board: "replit", domain: "replit.com" },
  { id: "baseten", name: "Baseten", board: "baseten", domain: "baseten.co" },
  { id: "cognition", name: "Cognition", board: "cognition", domain: "cognition.ai" },
];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Deliberately narrow: working at an AI company does not make a role an AI role.
export function isRelevantRole(title: string, context = ""): boolean {
  const name = title.toLowerCase();
  if (!/\b(engineer(?:ing)?|developer)\b/.test(name)) return false;
  if (/\b(?:product|program|project) manager\b/.test(name)) return false;
  if (/\b(design|designer|recruit|recruiter|sales|marketing|support|qa|security|hardware|electrical|mechanical|silicon|network|networking|datacenter|data center|compiler|compilers)\b/.test(name)) return false;
  if (/\b(research engineer|research engineering|pretrain(?:ing)?|post[- ]?train(?:ing)?|training|inference|infra|infrastructure|platform|accelerator|accelerators|machine learning|ml|reinforcement|rl|sre|devops|observability|kernel|kernels|gpu)\b/.test(name)) return false;
  if (/\b(ai|llm|llms|generative|genai|agent|agents|agentic|applied ai)\b/.test(name)) return true;
  // Generic application/FDE titles require explicit product-building evidence.
  return /\b(forward[- ]deployed|applied|product|application|applications|full[- ]stack)\b/.test(name)
    && /\b(build|building|develop|developing|ship|shipping|implement|implementing)\b[^.\n]{0,160}\b(ai applications?|ai agents?|llm applications?|llm[- ]powered|ai[- ]powered|agentic|rag|retrieval[- ]augmented)\b/i.test(context);
}

function httpsUrl(value: unknown, company: Company): string | null {
  try {
    const url = new URL(text(value));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (host !== "jobs.ashbyhq.com" && host !== company.domain && !host.endsWith(`.${company.domain}`)) return null;
    return url.href;
  } catch { return null; }
}

export function normalizeFeed(payload: unknown, company: Company, now = new Date()): FeedSnapshot {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) {
    throw new Error(`Invalid jobs response for ${company.name}`);
  }
  const jobs: Job[] = [];
  for (const value of (payload as { jobs: unknown[] }).jobs) {
    if (!value || typeof value !== "object") continue;
    const raw = value as Record<string, unknown>;
    // Never expose unlisted positions from an employer's public feed.
    if (raw.isListed !== true) continue;
    const title = text(raw.title);
    if (!isRelevantRole(title, text(raw.descriptionPlain))) continue;
    const sourceUrl = httpsUrl(raw.jobUrl, company);
    const applyUrl = httpsUrl(raw.applyUrl, company) ?? sourceUrl;
    if (!sourceUrl || !applyUrl) continue;
    const secondary = Array.isArray(raw.secondaryLocations) ? raw.secondaryLocations : [];
    const locations = [...new Set([text(raw.location), ...secondary.map((item: unknown) =>
      item && typeof item === "object" ? text((item as Record<string, unknown>).location) : ""
    )].filter(Boolean))];
    const date = text(raw.publishedAt);
    const timestamp = Date.parse(date);
    // Unknown publication dates stay unknown; fetching a job is not posting it.
    const publishedAt = Number.isFinite(timestamp) && timestamp <= now.getTime() + 86_400_000
      ? new Date(timestamp).toISOString() : null;
    const workplace = ["Remote", "Hybrid", "OnSite"].includes(text(raw.workplaceType))
      ? text(raw.workplaceType) as Workplace : "Unknown";
    jobs.push({
      id: `${company.id}:${sourceUrl.replace(/\/apply\/?$/, "").split("?")[0]}`,
      companyId: company.id, company: company.name, domain: company.domain,
      title, locations, workplace, publishedAt, applyUrl, sourceUrl,
    });
  }
  return { company, jobs: deduplicateJobs(jobs), fetchedAt: now.toISOString() };
}

export function deduplicateJobs(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  return jobs.filter(job => {
    const key = `${job.companyId}:${job.sourceUrl.split("?")[0].replace(/\/$/, "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function combineFeeds(results: PromiseSettledResult<FeedSnapshot>[], now = new Date()): JobsData {
  const feeds = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  const dates = feeds.map(feed => Date.parse(feed.fetchedAt));
  return {
    jobs: deduplicateJobs(feeds.flatMap(feed => feed.jobs)).sort((a, b) =>
      (b.publishedAt ? Date.parse(b.publishedAt) : -Infinity) - (a.publishedAt ? Date.parse(a.publishedAt) : -Infinity)
      || a.company.localeCompare(b.company) || a.title.localeCompare(b.title)),
    // The oldest successful feed indicates how fresh the whole displayed set is.
    updatedAt: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    stale: dates.some(date => now.getTime() - date > 90 * 60_000),
    unavailableSources: results.length - feeds.length,
    totalSources: results.length,
  };
}

export function filterJobs(jobs: Job[], query: string, remoteOnly: boolean, companies: string[]): Job[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return jobs.filter(job => {
    if (remoteOnly && job.workplace !== "Remote") return false;
    if (companies.length && !companies.includes(job.companyId)) return false;
    const haystack = `${job.title} ${job.company} ${job.locations.join(" ")} ${job.workplace === "OnSite" ? "on-site" : job.workplace}`.toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}

export function relativeDate(date: string | null, now = new Date()): string {
  if (!date) return "—";
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return "—";
  const days = Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 35) return `${Math.floor(days / 7)}w ago`;
  return "5w+ ago";
}
