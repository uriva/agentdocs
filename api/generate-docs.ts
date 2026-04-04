/**
 * generate-docs.ts — Generates all documentation artifacts from schema.ts.
 *
 * Run: deno run --allow-write --allow-read api/generate-docs.ts
 *
 * Outputs:
 *   api/docs.html    — Standalone API documentation page
 *   llms.txt         — LLM-consumable API reference (served at /llms.txt)
 *   README-api.md    — API reference section for the GitHub README
 */

import { routes, getFieldDocs, type RouteEntry } from "./schema.ts";

const BASE_URL = "https://agentdocs-api.uriva.deno.net";

// ─── Helpers ────────────────────────────────────────────────────────────────

type FieldDoc = {
  type: string;
  description?: string;
  required: boolean;
  enum?: string[];
  default?: unknown;
  properties?: Record<string, FieldDoc>;
  items?: FieldDoc;
};

function fieldDocToMarkdownTable(fields: Record<string, FieldDoc>, indent = 0): string {
  const rows: string[] = [];
  for (const [name, f] of Object.entries(fields)) {
    const prefix = "  ".repeat(indent);
    const req = f.required ? "**required**" : "optional";
    const type = f.enum ? f.enum.map((e) => `\`${e}\``).join(" \\| ") : f.type;
    const def = f.default !== undefined ? ` (default: \`${JSON.stringify(f.default)}\`)` : "";
    const desc = f.description || "";
    rows.push(`${prefix}| \`${name}\` | ${type} | ${req} | ${desc}${def} |`);

    if (f.properties) {
      for (const [subName, subF] of Object.entries(f.properties)) {
        const subReq = subF.required ? "**required**" : "optional";
        const subType = subF.enum ? subF.enum.map((e) => `\`${e}\``).join(" \\| ") : subF.type;
        const subDesc = subF.description || "";
        rows.push(`${prefix}| \`${name}.${subName}\` | ${subType} | ${subReq} | ${subDesc} |`);
      }
    }
    if (f.items?.properties) {
      for (const [subName, subF] of Object.entries(f.items.properties)) {
        const subReq = subF.required ? "**required**" : "optional";
        const subType = subF.enum ? subF.enum.map((e) => `\`${e}\``).join(" \\| ") : subF.type;
        const subDesc = subF.description || "";
        rows.push(`${prefix}| \`[].${subName}\` | ${subType} | ${subReq} | ${subDesc} |`);
      }
    }
  }
  return rows.join("\n");
}

function routeToMarkdown(route: RouteEntry): string {
  const lines: string[] = [];
  const badge = route.auth ? " 🔒" : "";
  lines.push(`### \`${route.method} ${route.path}\`${badge}`);
  lines.push("");
  lines.push(route.description);
  lines.push("");

  if (route.pathParams?.length) {
    lines.push("**Path parameters:**");
    lines.push("");
    for (const p of route.pathParams) {
      lines.push(`- \`${p.name}\` — ${p.description}`);
    }
    lines.push("");
  }

  if (route.request) {
    const fields = getFieldDocs(route.request);
    if (Object.keys(fields).length > 0) {
      lines.push("**Request body:**");
      lines.push("");
      lines.push("| Field | Type | Required | Description |");
      lines.push("|-------|------|----------|-------------|");
      lines.push(fieldDocToMarkdownTable(fields));
      lines.push("");
    }
  }

  const respFields = getFieldDocs(route.response);
  if (Object.keys(respFields).length > 0) {
    lines.push(`**Response** (\`${route.successStatus}\`):`);
    lines.push("");
    lines.push("| Field | Type | Required | Description |");
    lines.push("|-------|------|----------|-------------|");
    lines.push(fieldDocToMarkdownTable(respFields));
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Generate README-api.md ─────────────────────────────────────────────────

export function generateReadmeSection(): string {
  const sections: string[] = [];
  sections.push("## API Reference");
  sections.push("");
  sections.push(`Base URL: \`${BASE_URL}\``);
  sections.push("");
  sections.push("### Authentication");
  sections.push("");
  sections.push("All `/api/*` endpoints require signature-based authentication via three headers:");
  sections.push("");
  sections.push("| Header | Description |");
  sections.push("|--------|-------------|");
  sections.push("| `X-Identity-Id` | Your identity ID |");
  sections.push("| `X-Timestamp` | Current Unix timestamp in milliseconds |");
  sections.push("| `X-Signature` | Base64url-encoded Ed25519 signature |");
  sections.push("");
  sections.push("The signature covers: `METHOD\\nPATH\\nTIMESTAMP\\nSHA256(BODY)`");
  sections.push("");

  // Group by category
  const publicRoutes = routes.filter((r) => !r.auth);
  const docRoutes = routes.filter((r) => r.path.includes("/documents"));
  const ticketRoutes = routes.filter((r) => r.path.includes("/tickets"));
  const identityRoutes = routes.filter((r) => r.path.includes("/identities"));
  const webhookRoutes = routes.filter((r) => r.path.includes("/webhooks"));

  if (publicRoutes.length) {
    sections.push("### Public Endpoints");
    sections.push("");
    for (const r of publicRoutes) sections.push(routeToMarkdown(r));
  }
  if (identityRoutes.length) {
    sections.push("### Identities");
    sections.push("");
    for (const r of identityRoutes) sections.push(routeToMarkdown(r));
  }
  if (docRoutes.length) {
    sections.push("### Documents");
    sections.push("");
    for (const r of docRoutes) sections.push(routeToMarkdown(r));
  }
  if (ticketRoutes.length) {
    sections.push("### Tickets");
    sections.push("");
    for (const r of ticketRoutes) sections.push(routeToMarkdown(r));
  }
  if (webhookRoutes.length) {
    sections.push("### Webhooks");
    sections.push("");
    sections.push("Subscribe to real-time events on documents and tickets. Webhook payloads are signed with HMAC-SHA256 — verify using the `X-Webhook-Signature` header.");
    sections.push("");
    for (const r of webhookRoutes) sections.push(routeToMarkdown(r));
  }

  return sections.join("\n");
}

// ─── Generate llms.txt ──────────────────────────────────────────────────────

export function generateLlmsTxt(): string {
  const lines: string[] = [];
  lines.push("# agentdocs API");
  lines.push("");
  lines.push("> End-to-end encrypted document collaboration platform for AI agents and humans.");
  lines.push("> All content (titles, bodies, edits, comments) is encrypted client-side.");
  lines.push("> The server never sees plaintext.");
  lines.push("");
  lines.push(`## Base URL: ${BASE_URL}`);
  lines.push("");
  lines.push("## Authentication");
  lines.push("");
  lines.push("Routes under /api/* require Ed25519 signature auth via headers:");
  lines.push("- X-Identity-Id: identity UUID");
  lines.push("- X-Timestamp: Unix ms");
  lines.push("- X-Signature: base64url Ed25519 sig over METHOD\\nPATH\\nTIMESTAMP\\nSHA256(BODY)");
  lines.push("");
  lines.push("## Endpoints");
  lines.push("");

  for (const route of routes) {
    const auth = route.auth ? " [auth required]" : " [public]";
    lines.push(`### ${route.method} ${route.path}${auth}`);
    lines.push(route.summary);
    lines.push(route.description);

    if (route.pathParams?.length) {
      lines.push("Path params:");
      for (const p of route.pathParams) {
        lines.push(`  - ${p.name}: ${p.description}`);
      }
    }

    if (route.request) {
      const fields = getFieldDocs(route.request);
      lines.push("Request body (JSON):");
      for (const [name, f] of Object.entries(fields)) {
        const req = f.required ? "required" : "optional";
        const type = f.enum ? f.enum.join("|") : f.type;
        const def = f.default !== undefined ? ` default=${JSON.stringify(f.default)}` : "";
        lines.push(`  - ${name} (${type}, ${req}${def}): ${f.description || ""}`);
        if (f.properties) {
          for (const [sub, sf] of Object.entries(f.properties)) {
            const sr = sf.required ? "required" : "optional";
            lines.push(`    - ${sub} (${sf.type}, ${sr}): ${sf.description || ""}`);
          }
        }
      }
    }

    const respFields = getFieldDocs(route.response);
    lines.push(`Response (${route.successStatus}, JSON):`);
    for (const [name, f] of Object.entries(respFields)) {
      lines.push(`  - ${name} (${f.type}): ${f.description || ""}`);
      if (f.properties) {
        for (const [sub, sf] of Object.entries(f.properties)) {
          lines.push(`    - ${sub} (${sf.type}): ${sf.description || ""}`);
        }
      }
      if (f.items?.properties) {
        lines.push(`    Array items:`);
        for (const [sub, sf] of Object.entries(f.items.properties)) {
          lines.push(`    - ${sub} (${sf.type}): ${sf.description || ""}`);
        }
      }
    }

    lines.push("");
  }

  lines.push("## Error format");
  lines.push("All errors return: { error: string }");
  lines.push("");
  lines.push("## Webhook payload format");
  lines.push("When an event fires, agentdocs POSTs JSON to your URL with:");
  lines.push("- Headers: X-Webhook-Signature (HMAC-SHA256 hex), X-Webhook-Event (event type)");
  lines.push("- Body: { event, resourceType, resourceId, actorIdentityId, timestamp, data? }");
  lines.push("- Verify: compute HMAC-SHA256(your_secret, raw_body) and compare to X-Webhook-Signature");
  lines.push("- Payloads contain only plaintext metadata — fetch encrypted content via the API");
  lines.push("- Webhooks auto-disable after 10 consecutive delivery failures");
  lines.push("");
  lines.push("## Encryption model");
  lines.push("- Documents and tickets are E2E encrypted with AES-256-GCM");
  lines.push("- Keys are exchanged using X25519 key agreement");
  lines.push("- Edits and comments are signed with Ed25519 for tamper detection");
  lines.push("- The server stores only ciphertext; decryption happens client-side");

  return lines.join("\n");
}

// ─── Generate docs.html ─────────────────────────────────────────────────────

export function generateDocsHtml(): string {
  const mdContent = generateReadmeSection();
  // We embed the markdown as a simple styled HTML page
  // Convert markdown to HTML (simple converter for our subset)
  const htmlBody = markdownToHtml(mdContent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>agentdocs API Documentation</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --fg: #e5e5e5;
      --muted: #888;
      --border: #222;
      --code-bg: #141414;
      --accent: #fff;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.7;
      max-width: 800px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--accent); }
    h2 { font-size: 1.5rem; font-weight: 600; margin: 2.5rem 0 1rem; color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h3 { font-size: 1.1rem; font-weight: 500; margin: 2rem 0 0.5rem; }
    h3 code { font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; background: var(--code-bg); padding: 0.2em 0.5em; border-radius: 4px; }
    p { margin: 0.5rem 0; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; background: var(--code-bg); padding: 0.15em 0.35em; border-radius: 3px; }
    pre { background: var(--code-bg); padding: 1rem; border-radius: 6px; overflow-x: auto; margin: 0.5rem 0; }
    pre code { padding: 0; background: none; }
    table { width: 100%; border-collapse: collapse; margin: 0.5rem 0 1rem; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-weight: 500; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
    ul, ol { margin: 0.5rem 0 0.5rem 1.5rem; }
    li { margin: 0.25rem 0; }
    a { color: var(--accent); }
    .badge { display: inline-block; font-size: 0.7rem; padding: 0.1em 0.4em; border-radius: 3px; background: #333; color: #ccc; margin-left: 0.5rem; vertical-align: middle; }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>
  <h1>agentdocs API</h1>
  <p style="color: var(--muted); margin-bottom: 2rem;">End-to-end encrypted documents, spreadsheets, and tickets for AI agents.</p>
  ${htmlBody}
  <footer style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.85rem;">
    Generated from <code>schema.ts</code> &mdash; <a href="https://github.com/uriva/agentdocs">GitHub</a>
  </footer>
</body>
</html>`;
}

/** Minimal markdown-to-HTML converter for our controlled subset */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inTable = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (line.startsWith("### ")) {
      if (inTable) { out.push("</tbody></table>"); inTable = false; }
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      if (inTable) { out.push("</tbody></table>"); inTable = false; }
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    // Table
    if (line.startsWith("|")) {
      // Skip separator rows
      if (line.match(/^\|[\s\-:|]+\|$/)) continue;

      const cells = line.split("|").filter((_c, idx, arr) => idx > 0 && idx < arr.length - 1)
        .map((c) => c.trim());

      if (!inTable) {
        out.push('<table><thead><tr>');
        for (const cell of cells) out.push(`<th>${inlineMarkdown(cell)}</th>`);
        out.push('</tr></thead><tbody>');
        inTable = true;
      } else {
        out.push('<tr>');
        for (const cell of cells) out.push(`<td>${inlineMarkdown(cell)}</td>`);
        out.push('</tr>');
      }
      continue;
    }
    if (inTable && !line.startsWith("|")) {
      out.push("</tbody></table>");
      inTable = false;
    }

    // List items
    if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }
    if (inList && !line.startsWith("- ")) {
      out.push("</ul>");
      inList = false;
    }

    // Paragraph
    if (line.trim()) {
      out.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }

  if (inTable) out.push("</tbody></table>");
  if (inList) out.push("</ul>");

  return out.join("\n");
}

function inlineMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Escaped pipes
    .replace(/\\\|/g, "|");
}

// ─── CLI: write files when run directly ─────────────────────────────────────

if (import.meta.main) {
  const readmeApi = generateReadmeSection();
  const llmsTxt = generateLlmsTxt();
  const docsHtml = generateDocsHtml();

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Update root README: replace everything after the marker with the generated section
  const readmePath = "../README.md";
  const marker = "<!-- BEGIN GENERATED API DOCS -->";
  let readme = decoder.decode(await Deno.readFile(readmePath));
  const markerIdx = readme.indexOf(marker);
  if (markerIdx !== -1) {
    readme = readme.slice(0, markerIdx + marker.length) + "\n\n" + readmeApi + "\n";
  }

  await Promise.all([
    Deno.writeFile("docs.html", encoder.encode(docsHtml)),
    Deno.writeFile("../llms.txt", encoder.encode(llmsTxt)),
    Deno.writeFile("README-api.md", encoder.encode(readmeApi)),
    Deno.writeFile(readmePath, encoder.encode(readme)),
  ]);

  console.log("Generated:");
  console.log("  api/docs.html     — API documentation page");
  console.log("  llms.txt          — LLM-consumable reference");
  console.log("  api/README-api.md — README API section");
  console.log("  README.md         — Updated with API reference");
}
