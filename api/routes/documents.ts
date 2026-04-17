import { Hono } from "@hono/hono";
import {
  addEdit,
  createAccessGrant,
  createDocument,
  getDocumentEdits,
  getDocumentForIdentity,
  getDocumentsForIdentity,
  updateDocumentTitle,
} from "../db.ts";
import {
  CreateDocumentRequest,
  CreateEditRequest,
  ShareDocumentRequest,
  UpdateDocumentTitleRequest,
} from "../schema.ts";
import type { AppEnv } from "../types.ts";
import { fireWebhooks } from "./webhooks.ts";

export const documentsRouter = new Hono<AppEnv>();

/** Parse the request body (prefer rawBody stored by auth middleware) */
function parseBody(
  c: { get: (k: string) => unknown; req: { json: () => Promise<unknown> } },
) {
  const raw = c.get("rawBody") as string | undefined;
  return raw ? JSON.parse(raw) : c.req.json();
}

// ─── Standard CRUD ──────────────────────────────────────────────────────────

// List documents the identity has access to
documentsRouter.get("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const documents = await getDocumentsForIdentity(identityId);
  return c.json({ documents });
});

// Get a single document (with the caller's access grant)
documentsRouter.get("/:id", async (c) => {
  const identityId = c.get("identityId") as string;
  const documentId = c.req.param("id");
  const document = await getDocumentForIdentity(documentId, identityId);
  if (!document) return c.json({ error: "not found" }, 404);
  return c.json({ document });
});

// Create a new document
documentsRouter.post("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const raw = await parseBody(c);
  const parsed = CreateDocumentRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({
      error: parsed.error.issues.map((i: { message: string }) => i.message)
        .join("; "),
    }, 400);
  }

  const {
    type,
    encryptedTitle,
    encryptedTitleIv,
    algorithm,
    accessGrant,
  } = parsed.data;

  const doc = await createDocument({
    type,
    encryptedTitle,
    encryptedTitleIv,
    algorithm,
    creatorIdentityId: identityId,
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
    return c.json({
      error: parsed.error.issues.map((i: { message: string }) => i.message)
        .join("; "),
    }, 400);
  }

  const {
    encryptedContent,
    encryptedContentIv,
    signature,
    sequenceNumber,
    algorithm,
    editType,
  } = parsed.data;

  const edit = await addEdit({
    documentId,
    encryptedContent,
    encryptedContentIv,
    signature,
    sequenceNumber,
    algorithm,
    authorIdentityId: identityId,
    editType,
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

// Rename a document (update encrypted title)
documentsRouter.patch("/:id", async (c) => {
  const identityId = c.get("identityId") as string;
  const documentId = c.req.param("id");
  const raw = await parseBody(c);
  const parsed = UpdateDocumentTitleRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({
      error: parsed.error.issues.map((i: { message: string }) => i.message)
        .join("; "),
    }, 400);
  }

  const { encryptedTitle, encryptedTitleIv, algorithm } = parsed.data;

  // Update the document title
  await updateDocumentTitle({
    documentId,
    encryptedTitle,
    encryptedTitleIv,
    algorithm,
  });

  // Also record the rename as an edit so it appears in history
  const existingEdits = await getDocumentEdits(documentId);
  const nextSeq = existingEdits.length;

  await addEdit({
    documentId,
    encryptedContent: encryptedTitle,
    encryptedContentIv: encryptedTitleIv,
    signature: "", // Title edits don't require a signature
    sequenceNumber: nextSeq,
    algorithm,
    authorIdentityId: identityId,
    editType: "title",
  });

  fireWebhooks("document", documentId, "document.edited", identityId);

  return c.json({ ok: true });
});

// Share a document (create access grant for another identity)
documentsRouter.post("/:id/share", async (c) => {
  const grantorIdentityId = c.get("identityId") as string;
  const documentId = c.req.param("id");
  const raw = await parseBody(c);
  const parsed = ShareDocumentRequest.safeParse(raw);

  if (!parsed.success) {
    return c.json({
      error: parsed.error.issues.map((i: { message: string }) => i.message)
        .join("; "),
    }, 400);
  }

  const { granteeIdentityId, encryptedSymmetricKey, iv, salt, algorithm } =
    parsed.data;

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
