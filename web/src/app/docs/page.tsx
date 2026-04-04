import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "agentdocs — API Documentation",
  description:
    "End-to-end encrypted document collaboration platform for AI agents and humans. Full API reference.",
};

const API_BASE = "https://agentdocs-api.uriva.deno.net";

type Section = {
  heading: string;
  level: number;
  lines: string[];
};

function parseLlmsTxt(raw: string): { preamble: string[]; sections: Section[] } {
  const lines = raw.split("\n");
  const preamble: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);

    if (h3) {
      if (current) sections.push(current);
      current = { heading: h3[1], level: 3, lines: [] };
    } else if (h2) {
      if (current) sections.push(current);
      current = { heading: h2[1], level: 2, lines: [] };
    } else if (h1) {
      if (current) sections.push(current);
      current = { heading: h1[1], level: 1, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push(current);
  return { preamble, sections };
}

function renderLine(line: string, i: number) {
  const trimmed = line.trim();
  if (!trimmed) return <div key={i} className="h-3" />;

  // Blockquote
  if (trimmed.startsWith("> ")) {
    return (
      <p
        key={i}
        className="border-l-2 border-muted-foreground/30 pl-4 text-muted-foreground italic"
      >
        {trimmed.slice(2)}
      </p>
    );
  }

  // Bullet with inline code
  if (trimmed.startsWith("- ")) {
    return (
      <div key={i} className="flex gap-2 pl-4">
        <span className="text-muted-foreground select-none">-</span>
        <span>{renderInlineCode(trimmed.slice(2))}</span>
      </div>
    );
  }

  // Indented param lines (start with spaces + dash)
  if (line.startsWith("  ") && trimmed.startsWith("-")) {
    const indent = (line.length - line.trimStart().length) / 2;
    return (
      <div key={i} className="flex gap-2" style={{ paddingLeft: `${indent * 16 + 16}px` }}>
        <span className="text-muted-foreground select-none">-</span>
        <span className="text-sm">{renderInlineCode(trimmed.slice(2))}</span>
      </div>
    );
  }

  // Indented content lines
  if (line.startsWith("  ")) {
    const indent = (line.length - line.trimStart().length) / 2;
    return (
      <p key={i} className="text-sm text-muted-foreground" style={{ paddingLeft: `${indent * 16}px` }}>
        {renderInlineCode(trimmed)}
      </p>
    );
  }

  return (
    <p key={i}>{renderInlineCode(trimmed)}</p>
  );
}

function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="font-mono text-[0.85em] bg-muted/50 px-1.5 py-0.5 rounded border border-border/50"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function isEndpointHeading(heading: string) {
  return /^(GET|POST|PUT|PATCH|DELETE)\s+/.test(heading);
}

function renderEndpointBadge(method: string) {
  const colors: Record<string, string> = {
    GET: "bg-white/10 text-white border-white/20",
    POST: "bg-white/10 text-white border-white/20",
    PUT: "bg-white/10 text-white border-white/20",
    PATCH: "bg-white/10 text-white border-white/20",
    DELETE: "bg-white/5 text-muted-foreground border-white/10",
  };
  return (
    <span
      className={`font-mono text-[11px] font-medium px-2 py-0.5 rounded border ${colors[method] ?? colors.GET}`}
    >
      {method}
    </span>
  );
}

export default async function DocsPage() {
  const res = await fetch(`${API_BASE}/llms.txt`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load documentation.</p>
      </div>
    );
  }

  const raw = await res.text();
  const { preamble, sections } = parseLlmsTxt(raw);

  // Separate endpoint sections from other sections
  const endpointSections = sections.filter((s) => s.level === 3 && isEndpointHeading(s.heading));
  const otherSections = sections.filter((s) => !(s.level === 3 && isEndpointHeading(s.heading)));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 h-14">
          <a href="/" className="font-mono text-sm font-medium tracking-tight">
            agentdocs
          </a>
          <div className="flex items-center gap-4">
            <a
              href="/llms.txt"
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              llms.txt
            </a>
            <a
              href="https://github.com/uriva/agentdocs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Preamble */}
        <div className="space-y-2 mb-12">
          {preamble.map((line, i) => renderLine(line, i))}
        </div>

        {/* Non-endpoint sections (Auth, Base URL, etc.) */}
        {otherSections.map((section, i) => (
          <div key={`section-${i}`} className="mb-10">
            {section.level === 2 ? (
              <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border/30">
                {renderInlineCode(section.heading)}
              </h2>
            ) : (
              <h3 className="text-base font-medium mb-3">{renderInlineCode(section.heading)}</h3>
            )}
            <div className="space-y-1">
              {section.lines.map((line, j) => renderLine(line, j))}
            </div>
          </div>
        ))}

        {/* Endpoints */}
        {endpointSections.length > 0 && (
          <div className="space-y-1">
            <h2 className="text-lg font-semibold mb-6 pb-2 border-b border-border/30">
              Endpoints
            </h2>
            {endpointSections.map((section, i) => {
              const match = section.heading.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s*(.*)/);
              const method = match?.[1] ?? "";
              const path = match?.[2] ?? "";
              const tag = match?.[3] ?? "";

              return (
                <details
                  key={`ep-${i}`}
                  className="group border border-border/30 rounded-lg mb-3 overflow-hidden"
                >
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors select-none">
                    {renderEndpointBadge(method)}
                    <code className="font-mono text-sm">{path}</code>
                    {tag && (
                      <span className="text-[11px] text-muted-foreground font-mono">{tag}</span>
                    )}
                    <svg
                      className="ml-auto w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </summary>
                  <div className="px-4 pb-4 pt-1 border-t border-border/20 space-y-1">
                    {section.lines.map((line, j) => renderLine(line, j))}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border/20 text-center">
          <p className="text-xs text-muted-foreground font-mono">
            Generated from API schema &middot;{" "}
            <a href="/llms.txt" className="underline hover:text-foreground transition-colors">
              Raw llms.txt
            </a>{" "}
            &middot;{" "}
            <a href="/" className="underline hover:text-foreground transition-colors">
              Home
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
