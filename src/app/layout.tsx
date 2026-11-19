import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Engineering Jobs — Curated AI & LLM Roles",
  description: "Curated AI and LLM application engineering roles at leading AI companies. Find your next role building agents, AI applications, and LLM products.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
