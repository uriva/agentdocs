import { Hono } from "@hono/hono";
import {
  createDocument,
  addEdit,
  getDocumentEdits,
  createAccessGrant,
  getDocumentsForIdentity,
} from "../db.ts";
import type { AppEnv } from "../types.ts";

export const documentsRouter = new Hono<AppEnv>();

// List documents the identity has access to
documentsRouter.get("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const documents = await getDocumentsForIdentity(identityId);
  return c.json({ documents });
});

// Create a new document
documentsRouter.post("/", async (c) => {
  const identityId = c.get("identityId") as string;
  const body = c.get("rawBody")
    ? JSON.parse(c.get("rawBody") as string)
    : await c.req.json();

  const { type, encryptedTitle, encryptedTitleIv, algorithm, accessGrant } =
    body;

  if (
    !type ||
    !encryptedTitle ||
    !encryptedTitleIv ||
    !algorithm ||
    !accessGrant
  ) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  if (type !== "doc" && type !== "spreadsheet") {
    return c.json({ error: "Invalid document type" }, 400);
  }

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
  const body = c.get("rawBody")
    ? JSON.parse(c.get("rawBody") as string)
    : await c.req.json();

  const {
    encryptedContent,
    encryptedContentIv,
    signature,
    sequenceNumber,
    algorithm,
  } = body;

  if (
    !encryptedContent ||
    !encryptedContentIv ||
    !signature ||
    sequenceNumber === undefined ||
    !algorithm
  ) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // TODO: Verify the identity has an access grant for this document
  // TODO: Verify sequenceNumber is the next in sequence

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

  // TODO: Verify the requesting identity has an access grant

  const edits = await getDocumentEdits(documentId);
  return c.json({ edits });
});

// Share a document (create access grant for another identity)
documentsRouter.post("/:id/share", async (c) => {
  const grantorIdentityId = c.get("identityId") as string;
  const documentId = c.req.param("id");
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

  // TODO: Verify the grantor has access to this document

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
