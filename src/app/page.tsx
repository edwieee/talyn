import { connection } from "next/server";
import { CharacterField } from "@/components/character-field";
import { JobBoard } from "@/components/job-board";
import { getJobs } from "@/lib/feeds";

export const maxDuration = 60;

export default async function Home() {
  await connection();
  const data = await getJobs();
  return <>
    <a className="skip-link" href="#jobs">Skip to jobs</a>
    <CharacterField />
    <main className="page-container">
      <header className="hero">
        <h1>Curated AI engineering roles<br className="desktop-break" /> at AI companies</h1>
        <p>AI application, agent, and LLM engineering positions at the world’s leading artificial intelligence teams and companies.</p>
      </header>
      <div id="jobs"><JobBoard data={data} now={new Date().toISOString()} /></div>
    </main>
    <footer className="site-footer"><div className="page-container footer-content">
      <span>AI Engineering Jobs</span>
      <span>{data.updatedAt ? <>Last updated: <time dateTime={data.updatedAt}>{new Date(data.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</time></> : "Awaiting company feeds"}</span>
    </div></footer>
  </>;
}
