import { Hono } from "@hono/hono";
import {
  createDocument,
  addEdit,
  getDocumentEdits,
  createAccessGrant,
  getDocumentsForIdentity,
} from "../db.ts";
import {
  CreateDocumentRequest,
  CreateEditRequest,
  ShareDocumentRequest,
} from "../schema.ts";
import type { AppEnv } from "../types.ts";

export const documentsRouter = new Hono<AppEnv>();

/** Parse the request body (prefer rawBody stored by auth middleware) */
function parseBody(c: { get: (k: string) => unknown; req: { json: () => Promise<unknown> } }) {
  const raw = c.get("rawBody") as string | undefined;
  return raw ? JSON.parse(raw) : c.req.json();
}

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

  const { type, encryptedTitle, encryptedTitleIv, algorithm, accessGrant } = parsed.data;

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

  return c.json({ accessGrant: grant }, 201);
});
