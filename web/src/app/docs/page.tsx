import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "agentdocs — API Reference",
  description:
    "End-to-end encrypted document platform for AI agents. Full REST API reference.",
};

const API_BASE = "https://agentdocs-api.uriva.deno.net";

/* ── Types ───────────────────────────────────────────────────────── */

type Param = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  children?: Param[];
};

type Endpoint = {
  method: string;
  path: string;
  tag: string;
  summary: string;
  description: string;
  pathParams: Param[];
  bodyParams: Param[];
  responseStatus: string;
  responseParams: Param[];
};

type Section = {
  title: string;
  content: string;
};

/* ── Parser ──────────────────────────────────────────────────────── */

function parseLlmsTxt(raw: string) {
  const lines = raw.split("\n");
  const preambleLines: string[] = [];
  const sections: Section[] = [];
  const endpoints: Endpoint[] = [];

  let i = 0;

  // Preamble — everything before first ##
  while (i < lines.length && !lines[i].startsWith("## ")) {
    if (!lines[i].startsWith("# ")) preambleLines.push(lines[i]);
    i++;
  }

  // Process remaining lines
  while (i < lines.length) {
    const line = lines[i];

    // h3 endpoint
    if (line.startsWith("### ")) {
      const m = line.slice(4).match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s*(.*)/);
      if (m) {
        const ep = parseEndpoint(lines, i, m[1], m[2], m[3]);
        endpoints.push(ep.endpoint);
        i = ep.nextIndex;
        continue;
      }
    }

    // h2 section
    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      const contentLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("## ") && !lines[i].startsWith("### ")) {
        contentLines.push(lines[i]);
        i++;
      }
      sections.push({ title, content: contentLines.join("\n").trim() });
      continue;
    }

    i++;
  }

  return {
    preamble: preambleLines.join("\n").trim(),
    sections,
    endpoints,
  };
}

function parseEndpoint(
  lines: string[],
  startIndex: number,
  method: string,
  path: string,
  tag: string,
): { endpoint: Endpoint; nextIndex: number } {
  let i = startIndex + 1;
  const bodyLines: string[] = [];

  while (i < lines.length && !lines[i].startsWith("### ") && !lines[i].startsWith("## ")) {
    bodyLines.push(lines[i]);
    i++;
  }

  const body = bodyLines.join("\n");

  // First non-empty line is the summary
  const summaryLine = bodyLines.find((l) => l.trim() && !l.trim().startsWith("-"));
  const summary = summaryLine?.trim() ?? "";

  // Everything after the summary line until the first "keyword:" section is description
  const descLines: string[] = [];
  let j = summaryLine ? bodyLines.indexOf(summaryLine) + 1 : 0;
  while (j < bodyLines.length) {
    const trimmed = bodyLines[j].trim();
    if (
      trimmed.startsWith("Path params:") ||
      trimmed.startsWith("Request body") ||
      trimmed.startsWith("Response (")
    )
      break;
    if (trimmed) descLines.push(trimmed);
    j++;
  }

  const pathParams = parseParamBlock(body, "Path params:");
  const bodyParams = parseParamBlock(body, "Request body (JSON):");
  const responseMatch = body.match(/Response \((\d+),?\s*JSON\):/);
  const responseStatus = responseMatch?.[1] ?? "200";
  const responseParams = parseParamBlock(body, /Response \(\d+,?\s*JSON\):/);

  return {
    endpoint: {
      method,
      path,
      tag: tag.replace(/[[\]]/g, "").trim(),
      summary,
      description: descLines.join(" "),
      pathParams,
      bodyParams,
      responseStatus,
      responseParams,
    },
    nextIndex: i,
  };
}

function parseParamBlock(body: string, marker: string | RegExp): Param[] {
  const regex =
    typeof marker === "string"
      ? new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      : marker;
  const match = body.match(regex);
  if (!match) return [];

  const startIdx = body.indexOf(match[0]) + match[0].length;
  const rest = body.slice(startIdx);
  const lines = rest.split("\n");
  const params: Param[] = [];
  let currentParent: Param | null = null;

  for (const line of lines) {
    // Stop at next section
    if (
      line.trim() &&
      !line.startsWith(" ") &&
      !line.startsWith("\t") &&
      !line.trim().startsWith("-") &&
      !line.trim().startsWith("Array items:")
    )
      break;

    const trimmed = line.trim();
    if (!trimmed || trimmed === "Array items:") continue;

    if (trimmed.startsWith("- ")) {
      const indent = line.length - line.trimStart().length;
      const param = parseParamLine(trimmed.slice(2));
      if (param) {
        if (indent >= 4 && currentParent) {
          if (!currentParent.children) currentParent.children = [];
          currentParent.children.push(param);
        } else {
          params.push(param);
          currentParent = param;
        }
      }
    }
  }

  return params;
}

function parseParamLine(text: string): Param | null {
  // Format: "name (type, required/optional): description"
  const match = text.match(/^(\w+)\s*\(([^)]+)\)(?:\s*:\s*(.*))?/);
  if (match) {
    const name = match[1];
    const meta = match[2];
    const desc = match[3]?.trim() ?? "";
    const type =
      meta
        .split(",")
        .map((s) => s.trim())
        .filter(
          (s) =>
            s !== "required" &&
            s !== "optional" &&
            !s.startsWith("default=") &&
            !s.startsWith("optional "),
        )
        .join(", ") || "string";
    const required = meta.includes("required");
    return { name, type, required, description: desc };
  }

  // Simpler format: "name: description"
  const simple = text.match(/^(\w+)\s*:\s*(.*)/);
  if (simple) {
    return { name: simple[1], type: "string", required: false, description: simple[2].trim() };
  }

  return null;
}

/* ── Grouping ────────────────────────────────────────────────────── */

type EndpointGroup = {
  name: string;
  slug: string;
  endpoints: Endpoint[];
};

function groupEndpoints(endpoints: Endpoint[]): EndpointGroup[] {
  const groups: Record<string, Endpoint[]> = {};
  const order: string[] = [];

  for (const ep of endpoints) {
    let group = "General";
    if (ep.path.includes("/documents/by-slug")) group = "Wiki / Slugs";
    else if (ep.path.includes("/documents")) group = "Documents";
    else if (ep.path.includes("/tickets") && ep.path.includes("/comments"))
      group = "Ticket Comments";
    else if (ep.path.includes("/tickets") && ep.path.includes("/share"))
      group = "Ticket Sharing";
    else if (ep.path.includes("/tickets") && ep.path.includes("/assign"))
      group = "Ticket Assignment";
    else if (ep.path.includes("/tickets")) group = "Tickets";
    else if (ep.path.includes("/webhooks")) group = "Webhooks";
    else if (ep.path.includes("/identities")) group = "Identities";

    if (!groups[group]) {
      groups[group] = [];
      order.push(group);
    }
    groups[group].push(ep);
  }

  return order.map((name) => ({
    name,
    slug: name.toLowerCase().replace(/[\s/]+/g, "-"),
    endpoints: groups[name],
  }));
}

/* ── Render helpers ──────────────────────────────────────────────── */

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-foreground/10 text-foreground/90 border-foreground/20",
  POST: "bg-foreground/10 text-foreground/90 border-foreground/20",
  PUT: "bg-foreground/10 text-foreground/90 border-foreground/20",
  PATCH: "bg-foreground/10 text-foreground/90 border-foreground/20",
  DELETE: "bg-foreground/5 text-muted-foreground border-foreground/10",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-block font-mono text-[11px] font-semibold px-2 py-0.5 rounded border ${METHOD_STYLES[method] ?? METHOD_STYLES.GET} min-w-[52px] text-center`}
    >
      {method}
    </span>
  );
}

function ParamTable({ params, title }: { params: Param[]; title: string }) {
  if (params.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </h4>
      <div className="border border-border/40 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-left px-3 py-2 font-mono text-xs font-medium text-muted-foreground">
                Name
              </th>
              <th className="text-left px-3 py-2 font-mono text-xs font-medium text-muted-foreground">
                Type
              </th>
              <th className="text-left px-3 py-2 font-mono text-xs font-medium text-muted-foreground w-12">
                Req
              </th>
              <th className="text-left px-3 py-2 font-mono text-xs font-medium text-muted-foreground">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {params.map((p, i) => (
              <ParamRow
                key={`${p.name}-${i}`}
                param={p}
                depth={0}
                isLast={i === params.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParamRow({
  param,
  depth,
  isLast,
}: {
  param: Param;
  depth: number;
  isLast: boolean;
}) {
  return (
    <>
      <tr
        className={
          !isLast && !param.children
            ? "border-b border-border/20"
            : param.children
              ? "border-b border-border/20"
              : ""
        }
      >
        <td
          className="px-3 py-2 font-mono text-xs"
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {depth > 0 && <span className="text-muted-foreground/50 mr-1">&darr;</span>}
          {param.name}
        </td>
        <td className="px-3 py-2">
          <code className="text-xs font-mono text-muted-foreground">{param.type}</code>
        </td>
        <td className="px-3 py-2 text-center">
          {param.required ? (
            <span className="text-xs font-mono text-foreground/80">yes</span>
          ) : (
            <span className="text-xs font-mono text-muted-foreground/50">-</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{param.description}</td>
      </tr>
      {param.children?.map((child, i) => (
        <ParamRow
          key={`${child.name}-${i}`}
          param={child}
          depth={depth + 1}
          isLast={i === (param.children?.length ?? 1) - 1}
        />
      ))}
    </>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const anchor = `${ep.method.toLowerCase()}-${ep.path.replace(/[/:]/g, "-").replace(/^-+|-+$/g, "")}`;

  return (
    <div id={anchor} className="scroll-mt-20">
      {/* Method + Path bar */}
      <div className="flex items-center gap-3 px-4 py-3 border border-border/40 rounded-t-md bg-muted/10">
        <MethodBadge method={ep.method} />
        <code className="font-mono text-sm text-foreground">{ep.path}</code>
        {ep.tag && (
          <span className="ml-auto text-[10px] font-mono text-muted-foreground border border-border/30 rounded px-1.5 py-0.5">
            {ep.tag}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="border border-t-0 border-border/40 rounded-b-md px-4 py-4 space-y-4">
        <p className="text-sm">{ep.summary}</p>
        {ep.description && ep.description !== ep.summary && (
          <p className="text-sm text-muted-foreground">{ep.description}</p>
        )}

        <ParamTable params={ep.pathParams} title="Path Parameters" />
        <ParamTable params={ep.bodyParams} title="Request Body" />

        {ep.responseParams.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
              Response ({ep.responseStatus})
            </h4>
            <div className="border border-border/40 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <th className="text-left px-3 py-2 font-mono text-xs font-medium text-muted-foreground">
                      Field
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-xs font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-xs font-medium text-muted-foreground">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ep.responseParams.map((p, i) => (
                    <ResponseRow
                      key={`${p.name}-${i}`}
                      param={p}
                      depth={0}
                      isLast={i === ep.responseParams.length - 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResponseRow({
  param,
  depth,
  isLast,
}: {
  param: Param;
  depth: number;
  isLast: boolean;
}) {
  return (
    <>
      <tr className={!isLast || param.children ? "border-b border-border/20" : ""}>
        <td
          className="px-3 py-2 font-mono text-xs"
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {depth > 0 && <span className="text-muted-foreground/50 mr-1">&darr;</span>}
          {param.name}
        </td>
        <td className="px-3 py-2">
          <code className="text-xs font-mono text-muted-foreground">{param.type}</code>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{param.description}</td>
      </tr>
      {param.children?.map((child, i) => (
        <ResponseRow
          key={`${child.name}-${i}`}
          param={child}
          depth={depth + 1}
          isLast={i === (param.children?.length ?? 1) - 1}
        />
      ))}
    </>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default async function DocsPage() {
  const res = await fetch(`${API_BASE}/llms.txt`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Failed to load documentation.</p>
      </div>
    );
  }

  const raw = await res.text();
  const { preamble, sections, endpoints } = parseLlmsTxt(raw);
  const groups = groupEndpoints(endpoints);

  const authSection = sections.find((s) => s.title === "Authentication");
  const baseUrlSection = sections.find((s) => s.title.startsWith("Base URL"));
  const errorSection = sections.find((s) => s.title === "Error format");
  const webhookSection = sections.find((s) => s.title === "Webhook payload format");
  const encryptionSection = sections.find((s) => s.title === "Encryption model");

  const infoSections = [authSection, errorSection, webhookSection, encryptionSection].filter(
    Boolean,
  ) as Section[];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader showAuth={false} maxWidth="max-w-[90rem]" />

      <div className="mx-auto max-w-[90rem] flex">
        {/* Sidebar TOC */}
        <aside className="hidden lg:block w-56 shrink-0 border-r border-border/30 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-6 px-4">
          <nav className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-widest mb-2">
                Overview
              </p>
              {baseUrlSection && (
                <a
                  href="#base-url"
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                >
                  Base URL
                </a>
              )}
              {infoSections.map((s) => (
                <a
                  key={s.title}
                  href={`#${s.title.toLowerCase().replace(/\s+/g, "-")}`}
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                >
                  {s.title}
                </a>
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-widest mb-2">
                Endpoints
              </p>
              {groups.map((g) => (
                <a
                  key={g.slug}
                  href={`#${g.slug}`}
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                >
                  {g.name}
                  <span className="text-muted-foreground/40 ml-1">({g.endpoints.length})</span>
                </a>
              ))}
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 lg:px-10 py-10 max-w-4xl">
          {/* Title */}
          <div className="mb-10">
            <h1 className="text-2xl font-semibold tracking-tight mb-2">API Reference</h1>
            {preamble && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {preamble
                  .replace(/^>\s*/gm, "")
                  .replace(/\n/g, " ")
                  .trim()}
              </p>
            )}
          </div>

          {/* Base URL */}
          {baseUrlSection && (
            <section id="base-url" className="mb-10 scroll-mt-20">
              <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-border/30">
                Base URL
              </h2>
              <div className="font-mono text-sm bg-muted/20 border border-border/40 rounded-md px-4 py-3">
                {baseUrlSection.title.replace("Base URL: ", "").trim() ||
                  baseUrlSection.content}
              </div>
            </section>
          )}

          {/* Info sections */}
          {infoSections.map((section) => (
            <section
              key={section.title}
              id={section.title.toLowerCase().replace(/\s+/g, "-")}
              className="mb-10 scroll-mt-20"
            >
              <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-border/30">
                {section.title}
              </h2>
              <div className="bg-muted/10 border border-border/40 rounded-md px-4 py-3 space-y-2">
                {section.content.split("\n").map((line, li) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;
                  if (trimmed.startsWith("- ")) {
                    return (
                      <div key={li} className="flex gap-2 pl-2 text-sm">
                        <span className="text-muted-foreground/50 select-none shrink-0">
                          -
                        </span>
                        <span>{renderInline(trimmed.slice(2))}</span>
                      </div>
                    );
                  }
                  return (
                    <p key={li} className="text-sm">
                      {renderInline(trimmed)}
                    </p>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Endpoint groups */}
          {groups.map((group) => (
            <section key={group.slug} id={group.slug} className="mb-12 scroll-mt-20">
              <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border/30">
                {group.name}
              </h2>
              <div className="space-y-6">
                {group.endpoints.map((ep, ei) => (
                  <EndpointCard key={`${ep.method}-${ep.path}-${ei}`} ep={ep} />
                ))}
              </div>
            </section>
          ))}

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-border/20 text-center">
            <p className="text-xs text-muted-foreground font-mono">
              Auto-generated from API schema &middot;{" "}
              <a
                href="/llms.txt"
                className="underline hover:text-foreground transition-colors"
              >
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
    </div>
  );
}

/* ── Inline code renderer ────────────────────────────────────────── */

function renderInline(text: string) {
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
