import { Hono } from "@hono/hono";
import {
  createWebhook,
  getWebhooksForIdentity,
  deleteWebhook,
  getWebhooksForResource,
  recordWebhookFailure,
  recordWebhookSuccess,
} from "../db.ts";
import { CreateWebhookRequest } from "../schema.ts";
import type { AppEnv } from "../types.ts";

export const webhooksRouter = new Hono<AppEnv>();

/** Parse the request body (prefer rawBody stored by auth middleware) */
function parseBody(c: { get: (k: string) => unknown; req: { json: () => Promise<unknown> } }) {
  const raw = c.get("rawBody") as string | undefined;
  return raw ? JSON.parse(raw) : c.req.json();
}

// ─── HMAC Signing ─────────────────────────────────────────────────────────────

/** Generate a random 32-byte hex secret */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Sign a payload with HMAC-SHA256 */
async function signPayload(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Webhook Delivery ─────────────────────────────────────────────────────────

/**
 * Fire webhooks for a resource event. Non-blocking — errors are caught and
 * recorded but never propagated to the caller.
 */
export function fireWebhooks(
  resourceType: "document" | "ticket",
  resourceId: string,
  event: string,
  actorIdentityId: string,
  data?: Record<string, unknown>,
): void {
  // Run in background — don't block the response
  (async () => {
    try {
      const hooks = await getWebhooksForResource(resourceType, resourceId);

      for (const hook of hooks) {
        if (!hook.events.includes(event)) continue;

        const payload = JSON.stringify({
          event,
          resourceType,
          resourceId,
          actorIdentityId,
          timestamp: new Date().toISOString(),
          ...(data ? { data } : {}),
        });

        try {
          const signature = await signPayload(hook.secret, payload);
          const res = await fetch(hook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Signature": signature,
              "X-Webhook-Event": event,
            },
            body: payload,
            signal: AbortSignal.timeout(10_000), // 10s timeout
          });

          if (res.ok) {
            await recordWebhookSuccess(hook.id);
          } else {
            console.error(`Webhook ${hook.id} delivery failed: ${res.status}`);
            await recordWebhookFailure(hook.id);
          }
        } catch (err) {
          console.error(`Webhook ${hook.id} delivery error:`, err);
          await recordWebhookFailure(hook.id);
        }
      }
    } catch (err) {
      console.error("fireWebhooks error:", err);
    }
  })();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// List webhook subscriptions
webhooksRouter.get("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const hooks = await getWebhooksForIdentity(identityId);

  // Parse stored events JSON back to arrays, strip secret
  const webhooks = (hooks as Array<Record<string, unknown>>).map((h) => ({
    id: h.id,
    url: h.url,
    resourceType: h.resourceType,
    resourceId: h.resourceId,
    events: typeof h.events === "string" ? JSON.parse(h.events) : h.events,
    active: h.active,
    createdAt: h.createdAt ? new Date(h.createdAt as number).toISOString() : undefined,
  }));

  return c.json({ webhooks });
});

// Create a webhook subscription
webhooksRouter.post("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const raw = await parseBody(c);
  const parsed = CreateWebhookRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") },
      400,
    );
  }

  const { url, resourceType, resourceId, events } = parsed.data;

  // Validate HTTPS in production
  if (!url.startsWith("https://") && !url.startsWith("http://localhost")) {
    return c.json({ error: "Webhook URL must use HTTPS" }, 400);
  }

  const secret = generateWebhookSecret();

  const webhook = await createWebhook({
    url,
    resourceType,
    resourceId,
    events,
    secret,
    ownerIdentityId: identityId,
  });

  return c.json({ webhook: { id: webhook.id, secret } }, 201);
});

// Delete a webhook subscription
webhooksRouter.delete("/:id", async (c) => {
  const identityId = c.get("identityId") as string;
  const webhookId = c.req.param("id");

  const deleted = await deleteWebhook(webhookId, identityId);
  if (!deleted) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  return c.json({ ok: true });
});
