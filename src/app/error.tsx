"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="page-container"><header className="hero"><h1>A brief interruption.</h1><p>We couldn’t load the job board. Please try again.</p><button className="text-action error-retry" onClick={reset}>Try again <span aria-hidden="true">↗</span></button></header></main>;
}
