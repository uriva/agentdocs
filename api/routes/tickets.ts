import { Hono } from "@hono/hono";
import {
  createTicket,
  updateTicketMetadata,
  updateTicketEncryptedContent,
  addTicketComment,
  getTicketComments,
  getTicketsForIdentity,
  createTicketAccessGrant,
  assignTicket,
} from "../db.ts";
import {
  CreateTicketRequest,
  UpdateTicketMetadataRequest,
  UpdateTicketContentRequest,
  CreateCommentRequest,
  ShareTicketRequest,
  AssignTicketRequest,
} from "../schema.ts";
import type { AppEnv } from "../types.ts";
import { fireWebhooks } from "./webhooks.ts";

export const ticketsRouter = new Hono<AppEnv>();

/** Parse the request body (prefer rawBody stored by auth middleware) */
function parseBody(c: { get: (k: string) => unknown; req: { json: () => Promise<unknown> } }) {
  const raw = c.get("rawBody") as string | undefined;
  return raw ? JSON.parse(raw) : c.req.json();
}

// List tickets the identity has access to
ticketsRouter.get("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const tickets = await getTicketsForIdentity(identityId);
  return c.json({ tickets });
});

// Create a new ticket
ticketsRouter.post("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const raw = await parseBody(c);
  const parsed = CreateTicketRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const {
    encryptedTitle, encryptedTitleIv,
    encryptedBody, encryptedBodyIv,
    status, priority, algorithm, accessGrant,
  } = parsed.data;

  const ticket = await createTicket({
    encryptedTitle,
    encryptedTitleIv,
    encryptedBody,
    encryptedBodyIv,
    status,
    priority,
    algorithm,
    creatorIdentityId: identityId,
    accessGrant,
  });

  return c.json({ ticket }, 201);
});

// Update ticket metadata (status, priority)
ticketsRouter.patch("/:id", async (c) => {
  const ticketId = c.req.param("id");
  const raw = await parseBody(c);
  const parsed = UpdateTicketMetadataRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const { status, priority } = parsed.data;
  await updateTicketMetadata({ ticketId, status, priority });

  const identityId = c.get("identityId") as string;
  fireWebhooks("ticket", ticketId, "ticket.updated", identityId, {
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  });

  return c.json({ ok: true });
});

// Update ticket encrypted content (title + body)
ticketsRouter.put("/:id", async (c) => {
  const ticketId = c.req.param("id");
  const raw = await parseBody(c);
  const parsed = UpdateTicketContentRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const { encryptedTitle, encryptedTitleIv, encryptedBody, encryptedBodyIv, algorithm } =
    parsed.data;

  await updateTicketEncryptedContent({
    ticketId,
    encryptedTitle,
    encryptedTitleIv,
    encryptedBody,
    encryptedBodyIv,
    algorithm,
  });

  const identityId = c.get("identityId") as string;
  fireWebhooks("ticket", ticketId, "ticket.updated", identityId);

  return c.json({ ok: true });
});

// Add a comment to a ticket
ticketsRouter.post("/:id/comments", async (c) => {
  const identityId = c.get("identityId") as string;
  const ticketId = c.req.param("id");
  const raw = await parseBody(c);
  const parsed = CreateCommentRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const { encryptedContent, encryptedContentIv, signature, algorithm } = parsed.data;

  const comment = await addTicketComment({
    ticketId,
    encryptedContent,
    encryptedContentIv,
    signature,
    algorithm,
    authorIdentityId: identityId,
  });

  fireWebhooks("ticket", ticketId, "ticket.commented", identityId);

  return c.json({ comment }, 201);
});

// Get comments for a ticket
ticketsRouter.get("/:id/comments", async (c) => {
  const ticketId = c.req.param("id");
  const comments = await getTicketComments(ticketId);
  return c.json({ comments });
});

// Share a ticket
ticketsRouter.post("/:id/share", async (c) => {
  const grantorIdentityId = c.get("identityId") as string;
  const ticketId = c.req.param("id");
  const raw = await parseBody(c);
  const parsed = ShareTicketRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const { granteeIdentityId, encryptedSymmetricKey, iv, salt, algorithm } = parsed.data;

  const grant = await createTicketAccessGrant({
    ticketId,
    granteeIdentityId,
    grantorIdentityId,
    encryptedSymmetricKey,
    iv,
    salt,
    algorithm,
  });

  fireWebhooks("ticket", ticketId, "ticket.shared", grantorIdentityId, {
    granteeIdentityId,
  });

  return c.json({ accessGrant: grant }, 201);
});

// Assign a ticket to an identity
ticketsRouter.patch("/:id/assign", async (c) => {
  const ticketId = c.req.param("id");
  const raw = await parseBody(c);
  const parsed = AssignTicketRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const { assigneeIdentityId } = parsed.data;
  await assignTicket({ ticketId, assigneeIdentityId });

  const identityId = c.get("identityId") as string;
  fireWebhooks("ticket", ticketId, "ticket.assigned", identityId, {
    assigneeIdentityId,
  });

  return c.json({ ok: true });
});
