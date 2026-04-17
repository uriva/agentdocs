import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { verifyRequest } from "./crypto.ts";
import { getIdentityPublicKeys } from "./db.ts";
import { documentsRouter } from "./routes/documents.ts";
import { identitiesRouter } from "./routes/identities.ts";
import { ticketsRouter } from "./routes/tickets.ts";
import { webhooksRouter } from "./routes/webhooks.ts";
import { RegisterIdentityRequest } from "./schema.ts";
import type { AppEnv } from "./types.ts";

const app = new Hono<AppEnv>();

// CORS for web app
app.use(
  "/*",
  cors({
    origin: (origin) => {
      const allowed = [
        "http://localhost:3000",
        "https://agentdocs.dev",
        "https://web-uri1.vercel.app",
      ];
      if (allowed.includes(origin)) return origin;
      // Allow all Vercel preview deployments
      if (origin.endsWith(".vercel.app")) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowHeaders: [
      "Content-Type",
      "X-Identity-Id",
      "X-Timestamp",
      "X-Signature",
    ],
  }),
);

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// ─── Documentation Routes (public, no auth) ─────────────────────────────────

app.get("/llms.txt", async (c) => {
  const { generateLlmsTxt } = await import("./generate-docs.ts");
  c.header("Content-Type", "text/plain; charset=utf-8");
  return c.text(generateLlmsTxt());
});

app.get("/docs", async (c) => {
  const { generateDocsHtml } = await import("./generate-docs.ts");
  c.header("Content-Type", "text/html; charset=utf-8");
  return c.html(generateDocsHtml());
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
// Signature-based auth: every request must include:
//   X-Identity-Id: <identity-id>
//   X-Timestamp: <unix-ms>
//   X-Signature: <base64url-encoded Ed25519 signature>
//
// The signature covers: METHOD\nPATH\nTIMESTAMP\nSHA256(BODY)

app.use("/api/*", async (c, next) => {
  const identityId = c.req.header("X-Identity-Id");
  const timestampStr = c.req.header("X-Timestamp");
  const signature = c.req.header("X-Signature");

  if (!identityId || !timestampStr || !signature) {
    return c.json({ error: "Missing auth headers" }, 401);
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return c.json({ error: "Invalid timestamp" }, 401);
  }

  // Look up the identity's signing public key
  const keys = await getIdentityPublicKeys(identityId);
  if (!keys) {
    return c.json({ error: "Identity not found" }, 401);
  }

  // Get request body (if any)
  const body = c.req.method === "GET" || c.req.method === "HEAD"
    ? undefined
    : await c.req.text();

  const valid = await verifyRequest(
    c.req.method,
    new URL(c.req.url).pathname,
    timestamp,
    body,
    signature,
    keys.signingPublicKey,
  );

  if (!valid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  // Store identity info and parsed body on context for handlers
  c.set("identityId", identityId);
  c.set("identityKeys", keys);
  if (body) c.set("rawBody", body);

  await next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.route("/api/documents", documentsRouter);
app.route("/api/identities", identitiesRouter);
app.route("/api/tickets", ticketsRouter);
app.route("/api/webhooks", webhooksRouter);

// ─── Public Routes (no auth required) ────────────────────────────────────────
// Identity registration (requires InstantDB account token, not identity signature)

app.post("/register-identity", async (c) => {
  const body = await c.req.json();
  const parsed = RegisterIdentityRequest.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: parsed.error.issues.map((i: { message: string }) => i.message)
        .join("; "),
    }, 400);
  }

  try {
    const { createIdentity } = await import("./db.ts");
    const identity = await createIdentity({
      signingPublicKey: parsed.data.signingPublicKey,
      encryptionPublicKey: parsed.data.encryptionPublicKey,
      name: parsed.data.name || "Unnamed Identity",
      algorithmSuite: parsed.data.algorithmSuite,
      userId: parsed.data.userId,
    });

    return c.json({ identity });
  } catch (err) {
    console.error("register-identity error:", err);
    return c.json({
      error: err instanceof Error ? err.message : "Failed to create identity",
    }, 500);
  }
});

const port = parseInt(Deno.env.get("PORT") || "8787");
console.log(`agentdocs API listening on :${port}`);
Deno.serve({ port }, app.fetch);
