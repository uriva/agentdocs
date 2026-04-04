"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Lock,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Users,
  Code,
  BookOpen,
  Network,
  FileText,
  Table2,
  CircleDot,
  Webhook,
} from "lucide-react";
import { useState, useEffect, useRef, type RefObject } from "react";
import { CodeBlock } from "@/components/code-block";

/* ── Scroll-triggered animation hook ─────────────────────────────── */

function useInView(threshold = 0.15): [RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}

export default function Home() {
  return <LandingPage />;
}

/* ── Landing Page ──────────────────────────────────────────────────── */

function LandingPage() {
  const [problemRef, problemInView] = useInView(0.1);
  const [wikiRef, wikiInView] = useInView(0.1);
  const [featuresRef, featuresInView] = useInView(0.1);
  const [karpathyRef, karpathyInView] = useInView(0.15);
  const [stepsRef, stepsInView] = useInView(0.1);
  const [compoundsRef, compoundsInView] = useInView(0.15);
  const [cryptoRef, cryptoInView] = useInView(0.2);
  const [ctaRef, ctaInView] = useInView(0.2);

  return (
    <div className="grain flex flex-col min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm animate-fade-in">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-foreground flex items-center justify-center">
                <Lock className="h-3 w-3 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight">
                agentdocs
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/uriva/agentdocs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="GitHub"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
            <a
              href="https://agentdocs-api.uriva.deno.net/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              Docs
            </a>
            <a
              href="https://agentdocs-api.uriva.deno.net/llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              llms.txt
            </a>
            <ThemeToggle />
            <SignInButton />
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pt-24 pb-20">
          <div className="flex items-start gap-12 lg:gap-16">
            {/* Left — text */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Value props — scannable at a glance */}
              <div className="animate-fade-up delay-0 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-mono text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  End-to-end encrypted
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-mono text-muted-foreground">
                  <Terminal className="h-3 w-3" />
                  API-first
                </span>
                <a
                  href="https://github.com/uriva/agentdocs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Code className="h-3 w-3" />
                  Open source
                </a>
              </div>

              <h1 className="animate-fade-up delay-1 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
                Encrypted docs
                <br />
                for AI agents
              </h1>

              <p className="animate-fade-up delay-2 text-lg text-muted-foreground leading-relaxed max-w-lg">
                Documents, spreadsheets, tickets, and a wiki — all end-to-end
                encrypted, all through a REST API. Agents build persistent
                memory as linked pages. Humans read and edit the same content
                in the browser.
              </p>

              <div className="animate-fade-up delay-3 flex items-center gap-3 pt-2">
                <SignInButton size="lg" />
                <a
                  href="https://agentdocs-api.uriva.deno.net/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Read the docs
                </a>
              </div>
            </div>

            {/* Right — floating paper illustration */}
            <div className="hidden lg:block w-[340px] shrink-0">
              <HeroIllustration />
            </div>
          </div>

          {/* Code example — wiki upsert (the most distinctive API) */}
          <div className="animate-code-reveal delay-5 mt-16 rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50 ml-2">
                agent.ts
              </span>
            </div>
            <CodeBlock
              code={`// Wiki: upsert a page by slug — idempotent create-or-update
await fetch("/api/documents/by-slug/architecture-overview", {
  method: "PUT",
  headers: signedHeaders(identity),
  body: JSON.stringify({
    encryptedTitle: await encrypt("Architecture Overview", key),
    encryptedContent: await encrypt(markdown, key),
    accessGrant: firstTimeOnly,
  })
});

// Tickets: create an encrypted task
await fetch("/api/tickets", {
  method: "POST",
  headers: signedHeaders(identity),
  body: JSON.stringify({
    encryptedTitle: await encrypt("Fix auth timeout", key),
    encryptedBody: await encrypt(details, key),
    status: "open", priority: "high",
    accessGrant,
  })
});`}
            />
          </div>
        </section>

        {/* The Problem */}
        <section className="border-t" ref={problemRef as React.RefObject<HTMLElement>}>
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2
              className={`text-2xl font-semibold tracking-tight mb-4 transition-all duration-500 ${
                problemInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              Your agents forget everything
            </h2>
            <p
              className={`text-muted-foreground max-w-xl mb-12 transition-all duration-500 delay-100 ${
                problemInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              Every session starts from zero. Context, decisions, research —
              gone. You re-explain the same things to every agent, every time.
              Local tools don&apos;t help when your agents run in the cloud.
            </p>
            <div
              className={`grid sm:grid-cols-2 gap-8 transition-all duration-600 delay-200 ${
                problemInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-6"
              }`}
            >
              {/* Without */}
              <div className="rounded-lg border border-dashed p-6 space-y-3">
                <span className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                  Without agentdocs
                </span>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/40 mt-0.5 shrink-0">—</span>
                    Context lost every session
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/40 mt-0.5 shrink-0">—</span>
                    Copy-paste between tools and prompts
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/40 mt-0.5 shrink-0">—</span>
                    Local files that cloud agents can&apos;t reach
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/40 mt-0.5 shrink-0">—</span>
                    Unencrypted data scattered across services
                  </li>
                </ul>
              </div>
              {/* With */}
              <div className="rounded-lg border p-6 space-y-3 bg-foreground/[0.02]">
                <span className="text-[11px] font-mono text-foreground/70 uppercase tracking-wider">
                  With agentdocs
                </span>
                <ul className="space-y-2.5 text-sm text-foreground/80">
                  <li className="flex items-start gap-2">
                    <span className="text-foreground/40 mt-0.5 shrink-0">+</span>
                    One workspace every agent reads and writes to
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground/40 mt-0.5 shrink-0">+</span>
                    Hosted API — any agent, anywhere, zero sync
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground/40 mt-0.5 shrink-0">+</span>
                    End-to-end encrypted — the server sees only ciphertext
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground/40 mt-0.5 shrink-0">+</span>
                    Knowledge compounds with every task
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* What you get — all four forms */}
        <section className="border-t" ref={wikiRef as React.RefObject<HTMLElement>}>
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2
              className={`text-2xl font-semibold tracking-tight mb-4 transition-all duration-500 ${
                wikiInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              Four primitives, one API
            </h2>
            <p
              className={`text-muted-foreground max-w-xl mb-12 transition-all duration-500 delay-100 ${
                wikiInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              Everything an agent needs to store, organize, and share
              structured knowledge — encrypted before it leaves your process.
            </p>
            <div className="grid sm:grid-cols-2 gap-10">
              <Feature
                icon={BookOpen}
                title="Wiki"
                description="Agents write and link pages by slug, building a knowledge graph that grows with every task. PUT by slug creates or updates idempotently — no IDs to track."
                inView={wikiInView}
                delay={0}
              />
              <Feature
                icon={FileText}
                title="Documents"
                description="Long-form markdown documents with full edit history. Every revision is stored so you can diff, audit, and roll back. Rendered in-browser with formatting."
                inView={wikiInView}
                delay={1}
              />
              <Feature
                icon={Table2}
                title="Spreadsheets"
                description="Structured tabular data, encrypted cell-by-cell. Agents create and update rows through the API. Humans view and edit in a familiar grid."
                inView={wikiInView}
                delay={2}
              />
              <Feature
                icon={CircleDot}
                title="Tickets"
                description="Track tasks, bugs, and decisions with encrypted tickets. Status, priority, assignments, and threaded comments — all through the same signed API."
                inView={wikiInView}
                delay={3}
              />
            </div>
          </div>
        </section>

        {/* Webhooks + cross-cutting */}
        <section className="border-t" ref={featuresRef as React.RefObject<HTMLElement>}>
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="grid sm:grid-cols-3 gap-10">
              <Feature
                icon={Network}
                title="Linked knowledge graph"
                description="Reference other pages by slug in markdown. Agents build interconnected documentation that cross-references across docs, tickets, and wiki pages."
                inView={featuresInView}
                delay={0}
              />
              <Feature
                icon={Webhook}
                title="Webhook events"
                description="Subscribe to document edits, ticket updates, comments, shares, and assignments. HMAC-signed payloads keep your integrations in sync."
                inView={featuresInView}
                delay={1}
              />
              <Feature
                icon={Users}
                title="Unlimited identities"
                description="Create as many cryptographic identities as you need. Each gets its own key pair. Share content between agents and humans with ECDH key exchange."
                inView={featuresInView}
                delay={2}
              />
            </div>
          </div>
        </section>

        {/* Karpathy quote — the shift */}
        <section className="border-t" ref={karpathyRef as React.RefObject<HTMLElement>}>
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div
              className={`max-w-2xl mx-auto transition-all duration-600 ${
                karpathyInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-6"
              }`}
            >
              <span className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-6 block">
                The shift
              </span>
              <blockquote className="border-l-2 border-foreground/20 pl-6 space-y-4">
                <p className="text-lg leading-relaxed text-foreground/80 italic">
                  &ldquo;Using LLMs to build personal knowledge bases for various
                  topics of research interest. A large fraction of my recent token
                  throughput is going less into manipulating code, and more into
                  manipulating knowledge.&rdquo;
                </p>
                <p className="text-lg leading-relaxed text-foreground/80 italic">
                  &ldquo;I think there is room here for an incredible new product
                  instead of a hacky collection of scripts.&rdquo;
                </p>
                <footer className="text-sm text-muted-foreground pt-1">
                  — Andrej Karpathy
                </footer>
              </blockquote>
              <p className="text-sm text-muted-foreground mt-8 leading-relaxed max-w-lg">
                agentdocs is that product — but hosted, encrypted, and API-first.
                No local scripts, no file syncing. Your agents write to it from
                anywhere. The server never sees plaintext.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t" ref={stepsRef as React.RefObject<HTMLElement>}>
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2
              className={`text-2xl font-semibold tracking-tight mb-10 transition-all duration-500 ${
                stepsInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              How it works
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-16 gap-y-8">
              <Step
                number="01"
                title="Register an identity"
                description="Generate Ed25519 + X25519 keys. Register via the API. Each agent or human gets their own cryptographic identity."
                inView={stepsInView}
                delay={1}
              />
              <Step
                number="02"
                title="Create docs, sheets, or tickets"
                description="POST encrypted content through the REST API. Or PUT wiki pages by slug for idempotent upserts. Agents never need to track IDs."
                inView={stepsInView}
                delay={2}
              />
              <Step
                number="03"
                title="Link and cross-reference"
                description="Reference other pages by slug in markdown. Agents build a growing knowledge graph across documents, tickets, and wiki pages."
                inView={stepsInView}
                delay={3}
              />
              <Step
                number="04"
                title="Share across identities"
                description="Grant access by wrapping the content's AES key with ECDH. Agents and humans collaborate on the same encrypted workspace."
                inView={stepsInView}
                delay={4}
              />
            </div>
          </div>
        </section>

        {/* Knowledge compounds */}
        <section className="border-t" ref={compoundsRef as React.RefObject<HTMLElement>}>
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="max-w-2xl">
              <h2
                className={`text-2xl font-semibold tracking-tight mb-4 transition-all duration-500 ${
                  compoundsInView
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                }`}
              >
                Knowledge compounds
              </h2>
              <p
                className={`text-muted-foreground leading-relaxed mb-8 transition-all duration-500 delay-100 ${
                  compoundsInView
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                }`}
              >
                Every agent run adds to the knowledge base. Research notes
                link to decision docs. Tickets reference architecture pages.
                The graph grows denser and more useful with every task —
                and it&apos;s always one API call away from any agent, on any
                platform, in any cloud.
              </p>
            </div>
            <div
              className={`grid sm:grid-cols-3 gap-6 transition-all duration-600 delay-200 ${
                compoundsInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-6"
              }`}
            >
              <div className="rounded-lg border p-5 space-y-2">
                <span className="text-[28px] font-bold tracking-tight text-foreground">
                  Day 1
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  An agent registers, creates its first wiki page, logs a
                  decision. A single document in the graph.
                </p>
              </div>
              <div className="rounded-lg border p-5 space-y-2">
                <span className="text-[28px] font-bold tracking-tight text-foreground">
                  Week 2
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Dozens of linked pages. Tickets track open questions.
                  A spreadsheet aggregates metrics. Agents cross-reference
                  each other&apos;s work.
                </p>
              </div>
              <div className="rounded-lg border p-5 space-y-2">
                <span className="text-[28px] font-bold tracking-tight text-foreground">
                  Month 3
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A dense knowledge graph that new agents can onboard from
                  instantly. Institutional memory that survives any single
                  session, model, or provider.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Crypto details */}
        <section className="border-t" ref={cryptoRef as React.RefObject<HTMLElement>}>
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div
              className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-mono text-muted-foreground/60 transition-all duration-700 ${
                cryptoInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              <span>Ed25519 signing</span>
              <span className="text-muted-foreground/20">|</span>
              <span>X25519 ECDH</span>
              <span className="text-muted-foreground/20">|</span>
              <span>AES-256-GCM</span>
              <span className="text-muted-foreground/20">|</span>
              <span>HKDF-SHA256</span>
              <span className="text-muted-foreground/20">|</span>
              <span>Web Crypto API</span>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t" ref={ctaRef as React.RefObject<HTMLElement>}>
          <div
            className={`mx-auto max-w-4xl px-6 py-20 text-center transition-all duration-600 ${
              ctaInView
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
          >
            <h2 className="text-2xl font-semibold tracking-tight mb-3">
              Give your agents a workspace
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Docs, spreadsheets, tickets, and a wiki — encrypted and
              API-first. Open source. Free forever.
            </p>
            <SignInButton size="lg" />
          </div>
        </section>
      </main>
    </div>
  );
}

/* ── Hero illustration — floating paper cards ────────────────────── */

function HeroIllustration() {
  return (
    <div className="relative h-[360px] w-[340px] animate-fade-in delay-3">
      {/* Connecting lines (SVG behind cards) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 340 360"
        fill="none"
      >
        {/* Wiki → Doc */}
        <line
          x1="90" y1="100" x2="185" y2="195"
          className="hero-dash-line"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="1"
        />
        {/* Wiki → Spreadsheet */}
        <line
          x1="130" y1="75" x2="250" y2="50"
          className="hero-dash-line"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="1"
        />
        {/* Doc → Ticket */}
        <line
          x1="240" y1="230" x2="280" y2="145"
          className="hero-dash-line"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="1"
        />
      </svg>

      {/* Wiki page — largest, front */}
      <div
        className="hero-card hero-float-1 absolute left-0 top-[60px] w-[170px] p-3.5 z-30"
      >
        <div className="flex items-center gap-1.5 mb-2.5">
          <BookOpen className="h-3 w-3 text-foreground/50" />
          <span className="text-[9px] font-mono font-medium text-foreground/70 uppercase tracking-wider">
            Wiki
          </span>
        </div>
        <div className="h-2 w-24 rounded-full bg-foreground/15 mb-2" />
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-foreground/8" />
          <div className="h-1.5 w-full rounded-full bg-foreground/8" />
          <div className="h-1.5 w-3/4 rounded-full bg-foreground/8" />
        </div>
        <div className="mt-2.5 flex items-center gap-1">
          <span className="text-[8px] font-mono text-foreground/30">[[</span>
          <span className="text-[8px] font-mono text-foreground/50 border-b border-foreground/20">
            deploy-guide
          </span>
          <span className="text-[8px] font-mono text-foreground/30">]]</span>
        </div>
        <div className="space-y-1.5 mt-2">
          <div className="h-1.5 w-full rounded-full bg-foreground/8" />
          <div className="h-1.5 w-5/6 rounded-full bg-foreground/8" />
        </div>
      </div>

      {/* Spreadsheet — top right, small */}
      <div
        className="hero-card hero-float-2 absolute right-[20px] top-[20px] w-[120px] p-3 z-20"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Table2 className="h-3 w-3 text-foreground/50" />
          <span className="text-[9px] font-mono font-medium text-foreground/70 uppercase tracking-wider">
            Sheet
          </span>
        </div>
        {/* Mini grid */}
        <div className="grid grid-cols-3 gap-px">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className={`h-3.5 rounded-sm ${
                i < 3
                  ? "bg-foreground/12"
                  : "bg-foreground/6"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Document — center right */}
      <div
        className="hero-card hero-float-3 absolute right-[0px] top-[170px] w-[150px] p-3.5 z-20"
      >
        <div className="flex items-center gap-1.5 mb-2.5">
          <FileText className="h-3 w-3 text-foreground/50" />
          <span className="text-[9px] font-mono font-medium text-foreground/70 uppercase tracking-wider">
            Document
          </span>
        </div>
        <div className="h-2 w-20 rounded-full bg-foreground/15 mb-2" />
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-foreground/8" />
          <div className="h-1.5 w-full rounded-full bg-foreground/8" />
          <div className="h-1.5 w-5/6 rounded-full bg-foreground/8" />
          <div className="h-1.5 w-full rounded-full bg-foreground/8" />
          <div className="h-1.5 w-2/3 rounded-full bg-foreground/8" />
        </div>
      </div>

      {/* Ticket — bottom left */}
      <div
        className="hero-card hero-float-4 absolute left-[50px] top-[250px] w-[140px] p-3 z-10"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <CircleDot className="h-3 w-3 text-foreground/50" />
          <span className="text-[9px] font-mono font-medium text-foreground/70 uppercase tracking-wider">
            Ticket
          </span>
        </div>
        <div className="h-2 w-16 rounded-full bg-foreground/15 mb-2" />
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block h-1.5 w-8 rounded-full bg-foreground/20" />
          <span className="inline-block h-1.5 w-6 rounded-full bg-foreground/12" />
        </div>
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-foreground/8" />
          <div className="h-1.5 w-3/4 rounded-full bg-foreground/8" />
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
  inView = true,
  delay = 0,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  inView?: boolean;
  delay?: number;
}) {
  return (
    <div
      className={`space-y-3 transition-all duration-500 ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay * 150}ms` }}
    >
      <div className="h-9 w-9 rounded-lg bg-foreground/10 border border-foreground/20 flex items-center justify-center">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  inView = true,
  delay = 0,
}: {
  number: string;
  title: string;
  description: string;
  inView?: boolean;
  delay?: number;
}) {
  return (
    <div
      className={`flex gap-4 transition-all duration-500 ${
        inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3"
      }`}
      style={{ transitionDelay: `${delay * 150}ms` }}
    >
      <span className="text-[11px] font-mono text-foreground/60 pt-0.5 shrink-0">
        {number}
      </span>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

function SignInButton({ size = "default" }: { size?: "default" | "lg" }) {
  const { user, sendMagicCode, signInWithMagicCode } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);

  // Already signed in — show "Go to App"
  if (user) {
    return (
      <Button
        size={size === "lg" ? "lg" : "default"}
        className={size === "lg" ? "h-11 px-6 gap-2" : "h-8 px-3 gap-1.5 text-xs"}
        onClick={() => router.push("/app")}
      >
        Go to App
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    );
  }

  async function handleSendCode() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await sendMagicCode(email.trim());
      setStep("code");
    } catch {
      // toast not available on landing page, use alert
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      await signInWithMagicCode(email.trim(), code.trim());
      router.push("/app");
    } catch {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        size={size === "lg" ? "lg" : "default"}
        className={size === "lg" ? "h-11 px-6 gap-2" : "h-8 px-3 gap-1.5 text-xs"}
        onClick={() => setOpen(true)}
      >
        Get Started
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {step === "email" ? (
        <>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
            autoFocus
            className="h-8 w-52 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
          />
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleSendCode}
            disabled={!email.trim() || loading}
          >
            {loading ? "..." : "Send Code"}
          </Button>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
            autoFocus
            className="h-8 w-28 rounded-lg border bg-background px-2.5 text-xs font-mono text-center tracking-widest outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
          />
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleVerifyCode}
            disabled={!code.trim() || loading}
          >
            {loading ? "..." : "Verify"}
          </Button>
          <button
            onClick={() => {
              setStep("email");
              setCode("");
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            back
          </button>
        </>
      )}
    </div>
  );
}
