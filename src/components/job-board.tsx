"use client";

import { useId, useMemo, useState } from "react";
import { filterJobs, relativeDate, type Job, type JobsData } from "@/lib/jobs";

function SearchIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></svg>;
}

function CloseIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>;
}

function CompanyLogo({ job }: { job: Job }) {
  const [failed, setFailed] = useState(false);
  return <span className="company-logo" aria-hidden="true">
    {failed ? <span className="logo-initial">{job.company.charAt(0)}</span> :
      // Native img permits an immediate initial fallback without an image proxy.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(job.domain)}&sz=64`} alt="" width="18" height="18" loading="lazy" onError={() => setFailed(true)} />}
  </span>;
}

export function JobBoard({ data, now }: { data: JobsData; now: string }) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState(false);
  const [companies, setCompanies] = useState<string[]>([]);
  const jobs = useMemo(() => filterJobs(data.jobs, query, remote, companies), [data.jobs, query, remote, companies]);
  const companyCount = new Set(jobs.map(job => job.companyId)).size;
  const selected = companies.map(id => data.jobs.find(job => job.companyId === id)).filter((job): job is Job => !!job);
  const filtering = Boolean(query || remote || companies.length);
  const unavailable = !data.updatedAt && data.unavailableSources > 0;

  function reset() { setQuery(""); setRemote(false); setCompanies([]); }
  function toggleCompany(id: string) { setCompanies(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }

  return <section className="board" aria-label="AI engineering job listings">
    <div className="toolbar">
      <div className="filters">
        <div className="search-control">
          <label htmlFor={searchId} className="sr-only">Search roles, companies, locations</label>
          <span className="search-icon"><SearchIcon /></span>
          <input id={searchId} type="search" placeholder="Search roles, companies, locations..." value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />
          {query && <button className="clear-search" aria-label="Clear search" onClick={() => setQuery("")}><CloseIcon /></button>}
        </div>
        <label className="remote-control">
          <input type="checkbox" checked={remote} onChange={event => setRemote(event.target.checked)} />
          <span>Remote Only</span>
        </label>
        {selected.map(job => <button key={job.companyId} className="company-chip" onClick={() => toggleCompany(job.companyId)} aria-label={`Remove ${job.company} filter`}>{job.company}<CloseIcon /></button>)}
      </div>
      <p className="result-count" role="status" aria-live="polite" aria-atomic="true">
        {unavailable ? "Listings temporarily unavailable" : `${jobs.length} ${jobs.length === 1 ? "position" : "positions"} at ${companyCount} ${companyCount === 1 ? "company" : "companies"}`}
      </p>
    </div>

    {(data.stale || (data.unavailableSources > 0 && !unavailable)) && <p className="feed-notice" role="status">
      {data.stale ? "Showing the last available listings while sources refresh." : "Some company feeds are temporarily unavailable. Showing available listings."}
      {" "}<a href="/">Try again</a>
    </p>}

    <div className="table-frame">
      <div className="table-scroll" role="region" aria-label="Job listings table; scroll horizontally on smaller screens" tabIndex={0}>
        <table>
          <caption className="sr-only">Current AI and LLM application engineering openings, newest first</caption>
          <colgroup><col className="col-company" /><col className="col-role" /><col className="col-location" /><col className="col-posted" /><col className="col-apply" /></colgroup>
          <thead><tr><th scope="col">Company</th><th scope="col">Role</th><th scope="col">Location</th><th scope="col" aria-sort="descending">Posted <span className="sort-arrow" aria-hidden="true">↓</span></th><th scope="col"><span className="sr-only">Application</span></th></tr></thead>
          <tbody>
            {jobs.map(job => <tr key={job.id}>
              <td><button className="company-button" onClick={() => toggleCompany(job.companyId)} aria-label={`Filter by ${job.company}`} aria-pressed={companies.includes(job.companyId)}><CompanyLogo job={job} /><span>{job.company}</span></button></td>
              <td className="role-cell" title={job.title}>{job.title}</td>
              <td className="location-cell" title={`${job.locations.join(" · ") || "Location not specified"}${job.workplace !== "Unknown" ? ` (${job.workplace === "OnSite" ? "On-site" : job.workplace})` : ""}`}>{job.locations.length ? job.locations.join(" · ") : job.workplace === "Remote" ? "Remote" : "Not specified"}{job.workplace === "Remote" && !job.locations.some(location => /remote/i.test(location)) ? " · Remote" : ""}</td>
              <td className="date-cell">{job.publishedAt ? <time dateTime={job.publishedAt} title={new Date(job.publishedAt).toUTCString()}>{relativeDate(job.publishedAt, new Date(now))}</time> : <span title="Publication date not provided">—</span>}</td>
              <td className="apply-cell"><a className="apply-button" href={job.applyUrl} target="_blank" rel="noopener noreferrer" aria-label={`Apply for ${job.title} at ${job.company} (opens in a new tab)`}>Apply</a></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!jobs.length && <div className="empty-state" role="status">
        <h2>{unavailable ? "The listings are taking a little longer." : filtering ? "No matching roles." : "No open roles right now."}</h2>
        <p>{unavailable ? "We couldn’t reach the company job boards. Please try again in a moment." : filtering ? "Try a different search or clear your filters to see all openings." : "New AI engineering opportunities will appear here as company feeds refresh."}</p>
        {filtering ? <button className="text-action" onClick={reset}>Clear filters <span aria-hidden="true">↗</span></button> : <a className="text-action" href="/">Refresh listings <span aria-hidden="true">↗</span></a>}
      </div>}
    </div>
  </section>;
}
