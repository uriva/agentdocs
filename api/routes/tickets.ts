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
import type { AppEnv } from "../types.ts";

export const ticketsRouter = new Hono<AppEnv>();

// List tickets the identity has access to
ticketsRouter.get("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const tickets = await getTicketsForIdentity(identityId);
  return c.json({ tickets });
});

// Create a new ticket
ticketsRouter.post("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const body = c.get("rawBody")
    ? JSON.parse(c.get("rawBody") as string)
    : await c.req.json();

  const {
    encryptedTitle,
    encryptedTitleIv,
    encryptedBody,
    encryptedBodyIv,
    status,
    priority,
    algorithm,
    accessGrant,
  } = body;

  if (
    !encryptedTitle ||
    !encryptedTitleIv ||
    !encryptedBody ||
    !encryptedBodyIv ||
    !algorithm ||
    !accessGrant
  ) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const validStatuses = ["open", "in_progress", "closed"];
  const validPriorities = ["low", "medium", "high", "urgent"];

  if (status && !validStatuses.includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }
  if (priority && !validPriorities.includes(priority)) {
    return c.json({ error: "Invalid priority" }, 400);
  }

  const ticket = await createTicket({
    encryptedTitle,
    encryptedTitleIv,
    encryptedBody,
    encryptedBodyIv,
    status: status || "open",
    priority: priority || "medium",
    algorithm,
    creatorIdentityId: identityId,
    accessGrant,
  });

  return c.json({ ticket }, 201);
});

// Update ticket metadata (status, priority) — plaintext, no re-encryption needed
ticketsRouter.patch("/:id", async (c) => {
  const ticketId = c.req.param("id");
  const body = c.get("rawBody")
    ? JSON.parse(c.get("rawBody") as string)
    : await c.req.json();

  const { status, priority } = body;

  const validStatuses = ["open", "in_progress", "closed"];
  const validPriorities = ["low", "medium", "high", "urgent"];

  if (status && !validStatuses.includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }
  if (priority && !validPriorities.includes(priority)) {
    return c.json({ error: "Invalid priority" }, 400);
  }

  if (!status && !priority) {
    return c.json({ error: "Nothing to update" }, 400);
  }

  await updateTicketMetadata({ ticketId, status, priority });
  return c.json({ ok: true });
});

// Update ticket encrypted content (title + body)
ticketsRouter.put("/:id", async (c) => {
  const ticketId = c.req.param("id");
  const body = c.get("rawBody")
    ? JSON.parse(c.get("rawBody") as string)
    : await c.req.json();

  const {
    encryptedTitle,
    encryptedTitleIv,
    encryptedBody,
    encryptedBodyIv,
    algorithm,
  } = body;

  if (
    !encryptedTitle ||
    !encryptedTitleIv ||
    !encryptedBody ||
    !encryptedBodyIv ||
    !algorithm
  ) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  await updateTicketEncryptedContent({
    ticketId,
    encryptedTitle,
    encryptedTitleIv,
    encryptedBody,
    encryptedBodyIv,
    algorithm,
  });

  return c.json({ ok: true });
});

// Add a comment to a ticket
ticketsRouter.post("/:id/comments", async (c) => {
  const identityId = c.get("identityId") as string;
  const ticketId = c.req.param("id");
  const body = c.get("rawBody")
    ? JSON.parse(c.get("rawBody") as string)
    : await c.req.json();

  const { encryptedContent, encryptedContentIv, signature, algorithm } = body;

  if (!encryptedContent || !encryptedContentIv || !signature || !algorithm) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const comment = await addTicketComment({
    ticketId,
    encryptedContent,
    encryptedContentIv,
    signature,
    algorithm,
    authorIdentityId: identityId,
  });

  return c.json({ comment }, 201);
});

// Get comments for a ticket
ticketsRouter.get("/:id/comments", async (c) => {
  const ticketId = c.req.param("id");
  const comments = await getTicketComments(ticketId);
  return c.json({ comments });
});

// Share a ticket (create access grant for another identity)
ticketsRouter.post("/:id/share", async (c) => {
  const grantorIdentityId = c.get("identityId") as string;
  const ticketId = c.req.param("id");
  const body = c.get("rawBody")
    ? JSON.parse(c.get("rawBody") as string)
    : await c.req.json();

  const { granteeIdentityId, encryptedSymmetricKey, iv, salt, algorithm } =
    body;

  if (
    !granteeIdentityId ||
    !encryptedSymmetricKey ||
    !iv ||
    !salt ||
    !algorithm
  ) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const grant = await createTicketAccessGrant({
    ticketId,
    granteeIdentityId,
    grantorIdentityId,
    encryptedSymmetricKey,
    iv,
    salt,
    algorithm,
  });

  return c.json({ accessGrant: grant }, 201);
});

// Assign a ticket to an identity
ticketsRouter.patch("/:id/assign", async (c) => {
  const ticketId = c.req.param("id");
  const body = c.get("rawBody")
    ? JSON.parse(c.get("rawBody") as string)
    : await c.req.json();

  const { assigneeIdentityId } = body;
  if (!assigneeIdentityId) {
    return c.json({ error: "Missing assigneeIdentityId" }, 400);
  }

  await assignTicket({ ticketId, assigneeIdentityId });
  return c.json({ ok: true });
});
