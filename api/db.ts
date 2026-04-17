// Database operations for the Deno API.
// Uses InstantDB Admin SDK to read/write data.

const INSTANT_APP_ID = Deno.env.get("INSTANT_APP_ID") || "";
const INSTANT_ADMIN_TOKEN = Deno.env.get("INSTANT_ADMIN_TOKEN") || "";

const INSTANT_API = "https://api.instantdb.com/admin";

interface InstantQuery {
  [namespace: string]: {
    $?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

interface TransactionStep {
  op: "update" | "link" | "unlink" | "delete";
  ns: string;
  id: string;
  data?: Record<string, unknown>;
  link?: Record<string, string>;
}

// ─── Query Helper ─────────────────────────────────────────────────────────────

async function query(q: InstantQuery): Promise<Record<string, unknown[]>> {
  const res = await fetch(`${INSTANT_API}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INSTANT_ADMIN_TOKEN}`,
      "app-id": INSTANT_APP_ID,
    },
    body: JSON.stringify({ query: q }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`InstantDB query failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ─── Transaction Helper ───────────────────────────────────────────────────────

async function transact(steps: unknown[]): Promise<unknown> {
  const res = await fetch(`${INSTANT_API}/transact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INSTANT_ADMIN_TOKEN}`,
      "app-id": INSTANT_APP_ID,
    },
    body: JSON.stringify({ steps }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`InstantDB transact failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ─── Identity Operations ──────────────────────────────────────────────────────

export async function getIdentityPublicKeys(
  identityId: string,
): Promise<{ signingPublicKey: string; encryptionPublicKey: string } | null> {
  const result = await query({
    identities: {
      $: { where: { id: identityId } },
    },
  });

  const identities = result.identities as Array<{
    id: string;
    signingPublicKey: string;
    encryptionPublicKey: string;
  }>;

  if (!identities || identities.length === 0) return null;
  const identity = identities[0];
  return {
    signingPublicKey: identity.signingPublicKey,
    encryptionPublicKey: identity.encryptionPublicKey,
  };
}

export async function createIdentity(params: {
  signingPublicKey: string;
  encryptionPublicKey: string;
  name: string;
  algorithmSuite: string;
  userId: string;
}): Promise<{ id: string }> {
  const id = crypto.randomUUID();

  await transact([
    ["update", "identities", id, {
      signingPublicKey: params.signingPublicKey,
      encryptionPublicKey: params.encryptionPublicKey,
      name: params.name,
      algorithmSuite: params.algorithmSuite,
      userId: params.userId,
      createdAt: Date.now(),
    }],
  ]);

  return { id };
}

// ─── Document Operations ──────────────────────────────────────────────────────

export async function createDocument(params: {
  type: string;
  encryptedTitle: string;
  encryptedTitleIv: string;
  algorithm: string;
  creatorIdentityId: string;
  accessGrant: {
    encryptedSymmetricKey: string;
    iv: string;
    salt: string;
    algorithm: string;
  };
}): Promise<{ id: string }> {
  const docId = crypto.randomUUID();
  const grantId = crypto.randomUUID();

  await transact([
    // Create the document
    ["update", "documents", docId, {
      type: params.type,
      encryptedTitle: params.encryptedTitle,
      encryptedTitleIv: params.encryptedTitleIv,
      algorithm: params.algorithm,
      createdAt: Date.now(),
    }],
    // Link document to creator
    ["link", "documents", docId, { creator: params.creatorIdentityId }],
    // Create access grant for the creator
    ["update", "accessGrants", grantId, {
      encryptedSymmetricKey: params.accessGrant.encryptedSymmetricKey,
      iv: params.accessGrant.iv,
      salt: params.accessGrant.salt,
      algorithm: params.accessGrant.algorithm,
      createdAt: Date.now(),
    }],
    // Link access grant to document and identity
    ["link", "accessGrants", grantId, { document: docId }],
    ["link", "accessGrants", grantId, { grantee: params.creatorIdentityId }],
    ["link", "accessGrants", grantId, { grantor: params.creatorIdentityId }],
  ]);

  return { id: docId };
}

/** Update document title by its ID */
export async function updateDocumentTitle(params: {
  documentId: string;
  encryptedTitle: string;
  encryptedTitleIv: string;
  algorithm: string;
}): Promise<void> {
  await transact([
    ["update", "documents", params.documentId, {
      encryptedTitle: params.encryptedTitle,
      encryptedTitleIv: params.encryptedTitleIv,
      algorithm: params.algorithm,
      updatedAt: Date.now(),
    }],
  ]);
}

export async function addEdit(params: {
  documentId: string;
  encryptedContent: string;
  encryptedContentIv: string;
  signature: string;
  sequenceNumber: number;
  algorithm: string;
  authorIdentityId: string;
  editType?: "content" | "title";
}): Promise<{ id: string }> {
  const editId = crypto.randomUUID();

  await transact([
    ["update", "edits", editId, {
      encryptedContent: params.encryptedContent,
      encryptedContentIv: params.encryptedContentIv,
      signature: params.signature,
      sequenceNumber: params.sequenceNumber,
      algorithm: params.algorithm,
      editType: params.editType || "content",
      createdAt: Date.now(),
    }],
    ["link", "edits", editId, { document: params.documentId }],
    ["link", "edits", editId, { author: params.authorIdentityId }],
  ]);

  return { id: editId };
}

export async function getDocumentEdits(
  documentId: string,
): Promise<unknown[]> {
  const result = await query({
    edits: {
      $: {
        where: { "document.id": documentId },
        order: { serverCreatedAt: "asc" },
      },
      author: {},
    },
  });

  return (result.edits as unknown[]) || [];
}

export async function createAccessGrant(params: {
  documentId: string;
  granteeIdentityId: string;
  grantorIdentityId: string;
  encryptedSymmetricKey: string;
  iv: string;
  salt: string;
  algorithm: string;
}): Promise<{ id: string }> {
  const grantId = crypto.randomUUID();

  await transact([
    ["update", "accessGrants", grantId, {
      encryptedSymmetricKey: params.encryptedSymmetricKey,
      iv: params.iv,
      salt: params.salt,
      algorithm: params.algorithm,
      createdAt: Date.now(),
    }],
    ["link", "accessGrants", grantId, { document: params.documentId }],
    ["link", "accessGrants", grantId, { grantee: params.granteeIdentityId }],
    ["link", "accessGrants", grantId, { grantor: params.grantorIdentityId }],
  ]);

  return { id: grantId };
}

/** Fetch one document with its access grants for a specific identity */
export async function getDocumentForIdentity(
  documentId: string,
  identityId: string,
): Promise<Record<string, unknown> | null> {
  const result = await query({
    accessGrants: {
      $: {
        where: {
          "grantee.id": identityId,
          "document.id": documentId,
        },
      },
      document: {},
      grantor: {},
    },
  });
  const grants = (result.accessGrants as Array<{
    id: string;
    encryptedSymmetricKey: string;
    iv: string;
    salt: string;
    algorithm: string;
    document: Array<Record<string, unknown>>;
    grantor: Array<Record<string, unknown>>;
  }>) || [];
  if (grants.length === 0) return null;
  const doc = grants[0].document?.[0];
  if (!doc || !doc.id) return null;
  return {
    ...doc,
    accessGrants: grants.map((g) => ({
      id: g.id,
      encryptedSymmetricKey: g.encryptedSymmetricKey,
      iv: g.iv,
      salt: g.salt,
      algorithm: g.algorithm,
      grantor: g.grantor,
    })),
  };
}

export async function getDocumentsForIdentity(
  identityId: string,
): Promise<unknown[]> {
  // Query access grants for this identity, following links to documents and grantors
  const result = await query({
    accessGrants: {
      $: { where: { "grantee.id": identityId } },
      document: {},
      grantor: {},
    },
  });

  const grants = (result.accessGrants as Array<{
    id: string;
    encryptedSymmetricKey: string;
    iv: string;
    salt: string;
    algorithm: string;
    document: Array<Record<string, unknown>>;
    grantor: Array<Record<string, unknown>>;
  }>) || [];

  // Group by document, attaching access grant info
  const docMap = new Map<string, Record<string, unknown>>();
  for (const grant of grants) {
    const doc = grant.document?.[0];
    if (!doc || !doc.id) continue;
    const docId = doc.id as string;

    if (!docMap.has(docId)) {
      docMap.set(docId, {
        ...doc,
        accessGrants: [],
      });
    }

    const existing = docMap.get(docId)!;
    (existing.accessGrants as unknown[]).push({
      id: grant.id,
      encryptedSymmetricKey: grant.encryptedSymmetricKey,
      iv: grant.iv,
      salt: grant.salt,
      algorithm: grant.algorithm,
      grantor: grant.grantor,
    });
  }

  return Array.from(docMap.values());
}

export async function getIdentity(
  identityId: string,
): Promise<Record<string, unknown> | null> {
  const result = await query({
    identities: {
      $: { where: { id: identityId } },
    },
  });

  const identities = result.identities as unknown[];
  if (!identities || identities.length === 0) return null;
  return identities[0] as Record<string, unknown>;
}

// ─── Ticket Operations ────────────────────────────────────────────────────────

export async function createTicket(params: {
  encryptedTitle: string;
  encryptedTitleIv: string;
  encryptedBody: string;
  encryptedBodyIv: string;
  status: string;
  priority: string;
  algorithm: string;
  creatorIdentityId: string;
  accessGrant: {
    encryptedSymmetricKey: string;
    iv: string;
    salt: string;
    algorithm: string;
  };
}): Promise<{ id: string }> {
  const ticketId = crypto.randomUUID();
  const grantId = crypto.randomUUID();
  const now = Date.now();

  await transact([
    // Create the ticket
    ["update", "tickets", ticketId, {
      encryptedTitle: params.encryptedTitle,
      encryptedTitleIv: params.encryptedTitleIv,
      encryptedBody: params.encryptedBody,
      encryptedBodyIv: params.encryptedBodyIv,
      status: params.status,
      priority: params.priority,
      algorithm: params.algorithm,
      createdAt: now,
      updatedAt: now,
    }],
    // Link ticket to creator
    ["link", "tickets", ticketId, { creator: params.creatorIdentityId }],
    // Create self-grant for ticket
    ["update", "accessGrants", grantId, {
      encryptedSymmetricKey: params.accessGrant.encryptedSymmetricKey,
      iv: params.accessGrant.iv,
      salt: params.accessGrant.salt,
      algorithm: params.accessGrant.algorithm,
      createdAt: now,
    }],
    // Link access grant to ticket and identity
    ["link", "accessGrants", grantId, { ticket: ticketId }],
    ["link", "accessGrants", grantId, { grantee: params.creatorIdentityId }],
    ["link", "accessGrants", grantId, { grantor: params.creatorIdentityId }],
  ]);

  return { id: ticketId };
}

export async function updateTicketMetadata(params: {
  ticketId: string;
  status?: string;
  priority?: string;
  encryptedTitle?: string;
  encryptedTitleIv?: string;
  algorithm?: string;
}): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: Date.now() };
  if (params.status) data.status = params.status;
  if (params.priority) data.priority = params.priority;
  if (params.encryptedTitle && params.encryptedTitleIv) {
    data.encryptedTitle = params.encryptedTitle;
    data.encryptedTitleIv = params.encryptedTitleIv;
    if (params.algorithm) data.algorithm = params.algorithm;
  }

  await transact([
    ["update", "tickets", params.ticketId, data],
  ]);
}

export async function updateTicketEncryptedContent(params: {
  ticketId: string;
  encryptedTitle: string;
  encryptedTitleIv: string;
  encryptedBody: string;
  encryptedBodyIv: string;
  algorithm: string;
}): Promise<void> {
  await transact([
    ["update", "tickets", params.ticketId, {
      encryptedTitle: params.encryptedTitle,
      encryptedTitleIv: params.encryptedTitleIv,
      encryptedBody: params.encryptedBody,
      encryptedBodyIv: params.encryptedBodyIv,
      algorithm: params.algorithm,
      updatedAt: Date.now(),
    }],
  ]);
}

export async function addTicketComment(params: {
  ticketId: string;
  encryptedContent: string;
  encryptedContentIv: string;
  signature: string;
  algorithm: string;
  authorIdentityId: string;
}): Promise<{ id: string }> {
  const commentId = crypto.randomUUID();

  await transact([
    ["update", "ticketComments", commentId, {
      encryptedContent: params.encryptedContent,
      encryptedContentIv: params.encryptedContentIv,
      signature: params.signature,
      algorithm: params.algorithm,
      createdAt: Date.now(),
    }],
    ["link", "ticketComments", commentId, { ticket: params.ticketId }],
    ["link", "ticketComments", commentId, { author: params.authorIdentityId }],
  ]);

  return { id: commentId };
}

export async function getTicketComments(
  ticketId: string,
): Promise<unknown[]> {
  const result = await query({
    ticketComments: {
      $: {
        where: { "ticket.id": ticketId },
        order: { serverCreatedAt: "asc" },
      },
      author: {},
    },
  });

  return (result.ticketComments as unknown[]) || [];
}

export async function getTicketsForIdentity(
  identityId: string,
): Promise<unknown[]> {
  // Query access grants linked to tickets for this identity
  const result = await query({
    accessGrants: {
      $: { where: { "grantee.id": identityId } },
      ticket: {},
      grantor: {},
    },
  });

  const grants = (result.accessGrants as Array<{
    id: string;
    encryptedSymmetricKey: string;
    iv: string;
    salt: string;
    algorithm: string;
    ticket: Array<Record<string, unknown>>;
    grantor: Array<Record<string, unknown>>;
  }>) || [];

  // Group by ticket, attaching access grant info
  const ticketMap = new Map<string, Record<string, unknown>>();
  for (const grant of grants) {
    const ticket = grant.ticket?.[0];
    if (!ticket || !ticket.id) continue;
    const ticketId = ticket.id as string;

    if (!ticketMap.has(ticketId)) {
      ticketMap.set(ticketId, {
        ...ticket,
        accessGrants: [],
      });
    }

    const existing = ticketMap.get(ticketId)!;
    (existing.accessGrants as unknown[]).push({
      id: grant.id,
      encryptedSymmetricKey: grant.encryptedSymmetricKey,
      iv: grant.iv,
      salt: grant.salt,
      algorithm: grant.algorithm,
      grantor: grant.grantor,
    });
  }

  return Array.from(ticketMap.values());
}

export async function createTicketAccessGrant(params: {
  ticketId: string;
  granteeIdentityId: string;
  grantorIdentityId: string;
  encryptedSymmetricKey: string;
  iv: string;
  salt: string;
  algorithm: string;
}): Promise<{ id: string }> {
  const grantId = crypto.randomUUID();

  await transact([
    ["update", "accessGrants", grantId, {
      encryptedSymmetricKey: params.encryptedSymmetricKey,
      iv: params.iv,
      salt: params.salt,
      algorithm: params.algorithm,
      createdAt: Date.now(),
    }],
    ["link", "accessGrants", grantId, { ticket: params.ticketId }],
    ["link", "accessGrants", grantId, { grantee: params.granteeIdentityId }],
    ["link", "accessGrants", grantId, { grantor: params.grantorIdentityId }],
  ]);

  return { id: grantId };
}

export async function assignTicket(params: {
  ticketId: string;
  assigneeIdentityId: string;
}): Promise<void> {
  await transact([
    ["link", "tickets", params.ticketId, {
      assignee: params.assigneeIdentityId,
    }],
    ["update", "tickets", params.ticketId, { updatedAt: Date.now() }],
  ]);
}

// ─── Webhook Operations ───────────────────────────────────────────────────────

export async function createWebhook(params: {
  url: string;
  resourceType: string;
  resourceId: string;
  events: string[];
  secret: string;
  ownerIdentityId: string;
}): Promise<{ id: string }> {
  const id = crypto.randomUUID();

  await transact([
    ["update", "webhooks", id, {
      url: params.url,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      events: JSON.stringify(params.events),
      secret: params.secret,
      active: true,
      failureCount: 0,
      createdAt: Date.now(),
    }],
    ["link", "webhooks", id, { owner: params.ownerIdentityId }],
  ]);

  return { id };
}

export async function getWebhooksForIdentity(
  identityId: string,
): Promise<unknown[]> {
  const result = await query({
    webhooks: {
      $: { where: { "owner.id": identityId } },
    },
  });

  return (result.webhooks as unknown[]) || [];
}

export async function deleteWebhook(
  webhookId: string,
  ownerIdentityId: string,
): Promise<boolean> {
  // Verify ownership first
  const result = await query({
    webhooks: {
      $: { where: { id: webhookId, "owner.id": ownerIdentityId } },
    },
  });

  const hooks = (result.webhooks as unknown[]) || [];
  if (hooks.length === 0) return false;

  await transact([
    ["delete", "webhooks", webhookId, {}],
  ]);

  return true;
}

/** Find all active webhooks for a resource + event type */
export async function getWebhooksForResource(
  resourceType: string,
  resourceId: string,
): Promise<
  Array<{ id: string; url: string; secret: string; events: string[] }>
> {
  const result = await query({
    webhooks: {
      $: { where: { resourceType, resourceId, active: true } },
    },
  });

  const hooks = (result.webhooks as Array<Record<string, unknown>>) || [];
  return hooks.map((h) => ({
    id: h.id as string,
    url: h.url as string,
    secret: h.secret as string,
    events: JSON.parse(h.events as string) as string[],
  }));
}

/** Increment failure count; deactivate after 10 consecutive failures */
export async function recordWebhookFailure(webhookId: string): Promise<void> {
  // Read current failure count
  const result = await query({
    webhooks: {
      $: { where: { id: webhookId } },
    },
  });

  const hooks = (result.webhooks as Array<Record<string, unknown>>) || [];
  if (hooks.length === 0) return;

  const current = (hooks[0].failureCount as number) || 0;
  const newCount = current + 1;

  const data: Record<string, unknown> = { failureCount: newCount };
  if (newCount >= 10) {
    data.active = false;
  }

  await transact([
    ["update", "webhooks", webhookId, data],
  ]);
}

/** Reset failure count on successful delivery */
export async function recordWebhookSuccess(webhookId: string): Promise<void> {
  await transact([
    ["update", "webhooks", webhookId, { failureCount: 0 }],
  ]);
}
