import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { verifyRequest } from "./crypto.ts";
import { getIdentityPublicKeys } from "./db.ts";
import { documentsRouter } from "./routes/documents.ts";
import { identitiesRouter } from "./routes/identities.ts";
import type { AppEnv } from "./types.ts";

const app = new Hono<AppEnv>();

// CORS for web app
app.use("/*", cors({
  origin: ["http://localhost:3000", "https://agentdocs.dev"],
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "X-Identity-Id", "X-Timestamp", "X-Signature"],
}));

// Health check
app.get("/health", (c) => c.json({ ok: true }));

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
    keys.signingPublicKey
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

// ─── Public Routes (no auth required) ────────────────────────────────────────
// Identity registration (requires InstantDB account token, not identity signature)

app.post("/register-identity", async (c) => {
  // This endpoint is called by the web app after generating keys client-side.
  // The web app is authenticated via InstantDB session, and sends the public keys
  // to register. The Deno API writes them to InstantDB.
  const body = await c.req.json();
  const { signingPublicKey, encryptionPublicKey, name, algorithmSuite, userId } = body;

  if (!signingPublicKey || !encryptionPublicKey || !algorithmSuite || !userId) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // TODO: Verify InstantDB user token to confirm userId
  // For now, we trust the client (this will be secured via InstantDB admin token)

  const { createIdentity } = await import("./db.ts");
  const identity = await createIdentity({
    signingPublicKey,
    encryptionPublicKey,
    name: name || "Unnamed Identity",
    algorithmSuite,
    userId,
  });

  return c.json({ identity });
});

const port = parseInt(Deno.env.get("PORT") || "8787");
console.log(`agentdocs API listening on :${port}`);
Deno.serve({ port }, app.fetch);
