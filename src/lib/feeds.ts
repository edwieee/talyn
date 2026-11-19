import "server-only";
import { unstable_cache } from "next/cache";
import { COMPANIES, combineFeeds, normalizeFeed, type Company, type FeedSnapshot, type JobsData } from "./jobs";

async function fetchCompany(company: Company): Promise<FeedSnapshot> {
  const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company.board)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${company.name} feed returned ${response.status}`);
  return normalizeFeed(await response.json(), company);
}

// Cache the validated snapshot, not a failed HTTP response. Next keeps the last
// successful value when background revalidation throws. Each employer is isolated.
const readers = COMPANIES.map(company => unstable_cache(
  () => fetchCompany(company),
  ["ashby-ai-applications-v2", company.id, company.board],
  { revalidate: 3600, tags: ["jobs", `jobs-${company.id}`] },
));

export async function getJobs(): Promise<JobsData> {
  const results: PromiseSettledResult<FeedSnapshot>[] = [];
  // Bounded parallelism keeps cold starts polite to the provider.
  for (let index = 0; index < readers.length; index += 4) {
    results.push(...await Promise.allSettled(readers.slice(index, index + 4).map(read => read())));
  }
  results.forEach((result, index) => {
    if (result.status === "rejected") console.error(`[jobs:${COMPANIES[index].id}]`, String(result.reason));
  });
  return combineFeeds(results);
}
