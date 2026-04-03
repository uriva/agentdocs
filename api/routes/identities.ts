import { Hono } from "@hono/hono";
import { getIdentity } from "../db.ts";
import type { AppEnv } from "../types.ts";

export const identitiesRouter = new Hono<AppEnv>();

// Get an identity's public keys (for sharing)
identitiesRouter.get("/:id", async (c) => {
  const identityId = c.req.param("id");
  const identity = await getIdentity(identityId);

  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  // Only return public information
  return c.json({
    identity: {
      id: identity.id,
      signingPublicKey: identity.signingPublicKey,
      encryptionPublicKey: identity.encryptionPublicKey,
      name: identity.name,
      algorithmSuite: identity.algorithmSuite,
    },
  });
});
