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
    },
    body: JSON.stringify({ query: q, "app-id": INSTANT_APP_ID }),
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
    },
    body: JSON.stringify({ steps, "app-id": INSTANT_APP_ID }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`InstantDB transact failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ─── Identity Operations ──────────────────────────────────────────────────────

export async function getIdentityPublicKeys(
  identityId: string
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
      createdAt: Date.now(),
    }],
    ["link", "identities", id, { owner: params.userId }],
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

export async function addEdit(params: {
  documentId: string;
  encryptedContent: string;
  encryptedContentIv: string;
  signature: string;
  sequenceNumber: number;
  algorithm: string;
  authorIdentityId: string;
}): Promise<{ id: string }> {
  const editId = crypto.randomUUID();

  await transact([
    ["update", "edits", editId, {
      encryptedContent: params.encryptedContent,
      encryptedContentIv: params.encryptedContentIv,
      signature: params.signature,
      sequenceNumber: params.sequenceNumber,
      algorithm: params.algorithm,
      createdAt: Date.now(),
    }],
    ["link", "edits", editId, { document: params.documentId }],
    ["link", "edits", editId, { author: params.authorIdentityId }],
  ]);

  return { id: editId };
}

export async function getDocumentEdits(
  documentId: string
): Promise<unknown[]> {
  const result = await query({
    edits: {
      $: { where: { "document.id": documentId }, order: { serverCreatedAt: "asc" } },
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

export async function getDocumentsForIdentity(
  identityId: string
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
  identityId: string
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
