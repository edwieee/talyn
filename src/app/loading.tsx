import { CharacterField } from "@/components/character-field";

export default function Loading() {
  return <><CharacterField /><main className="page-container"><header className="hero"><h1>Curated AI engineering roles<br className="desktop-break" /> at AI companies</h1><p>AI application, agent, and LLM engineering positions at the world’s leading artificial intelligence teams and companies.</p></header><section className="loading-board" role="status" aria-live="polite"><span className="loading-dot" /> Finding the latest AI engineering roles…</section></main></>;
}
