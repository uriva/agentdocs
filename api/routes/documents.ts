import { Hono } from "@hono/hono";
import {
  createDocument,
  addEdit,
  getDocumentEdits,
  createAccessGrant,
  getDocumentsForIdentity,
  getDocumentBySlug,
  updateDocumentContent,
} from "../db.ts";
import {
  CreateDocumentRequest,
  CreateEditRequest,
  ShareDocumentRequest,
  UpsertDocumentBySlugRequest,
} from "../schema.ts";
import type { AppEnv } from "../types.ts";
import { fireWebhooks } from "./webhooks.ts";

export const documentsRouter = new Hono<AppEnv>();

/** Parse the request body (prefer rawBody stored by auth middleware) */
function parseBody(c: { get: (k: string) => unknown; req: { json: () => Promise<unknown> } }) {
  const raw = c.get("rawBody") as string | undefined;
  return raw ? JSON.parse(raw) : c.req.json();
}

// ─── Wiki / Slug-addressed routes ───────────────────────────────────────────
// These MUST be registered before /:id routes so "by-slug" isn't captured as an :id

// Get document by slug
documentsRouter.get("/by-slug/:slug", async (c) => {
  const identityId = c.get("identityId") as string;
  const slug = c.req.param("slug");

  const doc = await getDocumentBySlug(slug, identityId);
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  return c.json({ document: doc });
});

// Upsert document by slug (create or update) — the core agent wiki operation
documentsRouter.put("/by-slug/:slug", async (c) => {
  const identityId = c.get("identityId") as string;
  const slug = c.req.param("slug");
  const raw = await parseBody(c);
  const parsed = UpsertDocumentBySlugRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const {
    encryptedTitle,
    encryptedTitleIv,
    algorithm,
    accessGrant,
    encryptedContent,
    encryptedContentIv,
    signature,
  } = parsed.data;

  // Check if document with this slug already exists
  const existing = await getDocumentBySlug(slug, identityId);

  let docId: string;
  let created: boolean;

  if (existing) {
    // Update existing document title
    docId = existing.id as string;
    created = false;
    await updateDocumentContent({
      documentId: docId,
      encryptedTitle,
      encryptedTitleIv,
      algorithm,
    });
  } else {
    // Create new document — accessGrant is required
    if (!accessGrant) {
      return c.json({ error: "accessGrant is required when creating a new document" }, 400);
    }
    const doc = await createDocument({
      type: "doc",
      encryptedTitle,
      encryptedTitleIv,
      algorithm,
      creatorIdentityId: identityId,
      slug,
      accessGrant,
    });
    docId = doc.id;
    created = true;
  }

  // Optionally append an edit in the same call
  if (encryptedContent && encryptedContentIv) {
    // Get current edit count to derive sequenceNumber
    const edits = await getDocumentEdits(docId);
    const seq = (edits as unknown[]).length;

    await addEdit({
      documentId: docId,
      encryptedContent,
      encryptedContentIv,
      signature: signature || "",
      sequenceNumber: seq,
      algorithm,
      authorIdentityId: identityId,
    });

    fireWebhooks("document", docId, "document.edited", identityId);
  }

  return c.json({ document: { id: docId }, created });
});

// Get edits for a slug-addressed document
documentsRouter.get("/by-slug/:slug/edits", async (c) => {
  const identityId = c.get("identityId") as string;
  const slug = c.req.param("slug");

  const doc = await getDocumentBySlug(slug, identityId);
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const edits = await getDocumentEdits(doc.id as string);
  return c.json({ edits });
});

// Add edit to a slug-addressed document
documentsRouter.post("/by-slug/:slug/edits", async (c) => {
  const identityId = c.get("identityId") as string;
  const slug = c.req.param("slug");
  const raw = await parseBody(c);
  const parsed = CreateEditRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const doc = await getDocumentBySlug(slug, identityId);
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const { encryptedContent, encryptedContentIv, signature, sequenceNumber, algorithm } =
    parsed.data;

  const edit = await addEdit({
    documentId: doc.id as string,
    encryptedContent,
    encryptedContentIv,
    signature,
    sequenceNumber,
    algorithm,
    authorIdentityId: identityId,
  });

  fireWebhooks("document", doc.id as string, "document.edited", identityId);

  return c.json({ edit }, 201);
});

// ─── Standard CRUD ──────────────────────────────────────────────────────────

// List documents the identity has access to
documentsRouter.get("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const documents = await getDocumentsForIdentity(identityId);
  return c.json({ documents });
});

// Create a new document
documentsRouter.post("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const raw = await parseBody(c);
  const parsed = CreateDocumentRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const { type, encryptedTitle, encryptedTitleIv, algorithm, accessGrant, slug } = parsed.data;

  const doc = await createDocument({
    type,
    encryptedTitle,
    encryptedTitleIv,
    algorithm,
    creatorIdentityId: identityId,
    slug,
    accessGrant,
  });

  return c.json({ document: doc }, 201);
});

// Add an edit to a document
documentsRouter.post("/:id/edits", async (c) => {
  const identityId = c.get("identityId") as string;
  const documentId = c.req.param("id");
  const raw = await parseBody(c);
  const parsed = CreateEditRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const { encryptedContent, encryptedContentIv, signature, sequenceNumber, algorithm } =
    parsed.data;

  const edit = await addEdit({
    documentId,
    encryptedContent,
    encryptedContentIv,
    signature,
    sequenceNumber,
    algorithm,
    authorIdentityId: identityId,
  });

  fireWebhooks("document", documentId, "document.edited", identityId);

  return c.json({ edit }, 201);
});

// Get edits for a document
documentsRouter.get("/:id/edits", async (c) => {
  const documentId = c.req.param("id");
  const edits = await getDocumentEdits(documentId);
  return c.json({ edits });
});

// Share a document (create access grant for another identity)
documentsRouter.post("/:id/share", async (c) => {
  const grantorIdentityId = c.get("identityId") as string;
  const documentId = c.req.param("id");
  const raw = await parseBody(c);
  const parsed = ShareDocumentRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") }, 400);
  }

  const { granteeIdentityId, encryptedSymmetricKey, iv, salt, algorithm } = parsed.data;

  const grant = await createAccessGrant({
    documentId,
    granteeIdentityId,
    grantorIdentityId,
    encryptedSymmetricKey,
    iv,
    salt,
    algorithm,
  });

  fireWebhooks("document", documentId, "document.shared", grantorIdentityId, {
    granteeIdentityId,
  });

  return c.json({ accessGrant: grant }, 201);
});
