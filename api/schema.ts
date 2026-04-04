/**
 * schema.ts — Single source of truth for all agentdocs API schemas.
 *
 * Every endpoint's request body, response body, and metadata is defined here.
 * This file powers:
 *   1. Runtime validation in Hono route handlers (via Zod .parse())
 *   2. API documentation page (HTML)
 *   3. GitHub README API reference section
 *   4. llms.txt for LLM consumption
 */

import { z } from "zod";

// ─── Reusable field schemas ──────────────────────────────────────────────────

/** Base64-encoded encrypted data */
const encrypted = z.string().describe("Base64-encoded encrypted data");
/** Base64-encoded initialization vector */
const iv = z.string().describe("Base64-encoded initialization vector");
/** Encryption algorithm identifier */
const algorithm = z.string().describe("Encryption algorithm identifier (e.g. AES-GCM-256)");
/** Base64-encoded Ed25519 signature */
const signature = z.string().describe("Base64-encoded Ed25519 signature");
/** URL-safe slug for wiki-style document addressing */
const slug = z.string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .describe("URL-safe slug (lowercase alphanumeric + hyphens, e.g. 'project-roadmap')");

// ─── Shared sub-schemas ─────────────────────────────────────────────────────

const AccessGrantInput = z.object({
  encryptedSymmetricKey: encrypted.describe("Document symmetric key, encrypted for the grantee"),
  iv: iv.describe("IV used when encrypting the symmetric key"),
  salt: z.string().describe("Salt used in key derivation"),
  algorithm,
}).describe("Access grant: encrypted symmetric key bundle for a recipient");

const ShareInput = z.object({
  granteeIdentityId: z.string().describe("Identity ID of the recipient"),
  encryptedSymmetricKey: encrypted.describe("Document symmetric key, encrypted for the grantee"),
  iv: iv.describe("IV used when encrypting the symmetric key"),
  salt: z.string().describe("Salt used in key derivation"),
  algorithm,
}).describe("Share request: grant access to another identity");

// ─── Endpoint schemas ───────────────────────────────────────────────────────

// --- Health ---

export const HealthResponse = z.object({
  ok: z.literal(true),
}).describe("Health check response");

// --- Register Identity ---

export const RegisterIdentityRequest = z.object({
  signingPublicKey: z.string().describe("Base64-encoded Ed25519 signing public key"),
  encryptionPublicKey: z.string().describe("Base64-encoded X25519 encryption public key"),
  name: z.string().optional().describe("Human-readable display name"),
  algorithmSuite: z.string().describe("Algorithm suite identifier (e.g. Ed25519-X25519-AES256GCM)"),
  userId: z.string().describe("InstantDB user ID that owns this identity"),
}).describe("Create a new cryptographic identity");

export const RegisterIdentityResponse = z.object({
  identity: z.object({
    id: z.string().describe("Unique identity ID"),
  }),
}).describe("Newly created identity");

// --- Get Identity ---

export const GetIdentityResponse = z.object({
  identity: z.object({
    id: z.string().describe("Identity ID"),
    signingPublicKey: z.string().describe("Base64-encoded Ed25519 signing public key"),
    encryptionPublicKey: z.string().describe("Base64-encoded X25519 encryption public key"),
    name: z.string().describe("Display name"),
    algorithmSuite: z.string().describe("Algorithm suite identifier"),
  }),
}).describe("Identity public information");

// --- Documents ---

export const ListDocumentsResponse = z.object({
  documents: z.array(z.object({
    id: z.string(),
    type: z.enum(["doc", "spreadsheet"]),
    encryptedTitle: encrypted,
    encryptedTitleIv: iv,
    algorithm,
    slug: z.string().optional().describe("Wiki slug (plaintext) if set"),
    createdAt: z.string().optional(),
  })).describe("Documents the identity has access to"),
}).describe("List of accessible documents");

export const CreateDocumentRequest = z.object({
  type: z.enum(["doc", "spreadsheet"]).describe("Document type"),
  encryptedTitle: encrypted.describe("Encrypted document title"),
  encryptedTitleIv: iv.describe("IV for the encrypted title"),
  algorithm,
  slug: slug.optional().describe("Optional slug for wiki-style addressing (plaintext, unique per identity)"),
  accessGrant: AccessGrantInput.describe("Access grant for the creator"),
}).describe("Create a new encrypted document");

export const CreateDocumentResponse = z.object({
  document: z.object({
    id: z.string().describe("Newly created document ID"),
  }),
}).describe("Newly created document");

export const ListEditsResponse = z.object({
  edits: z.array(z.object({
    id: z.string(),
    encryptedContent: encrypted,
    encryptedContentIv: iv,
    signature,
    sequenceNumber: z.number(),
    algorithm,
    authorIdentityId: z.string(),
    createdAt: z.string().optional(),
  })).describe("Ordered list of document edits"),
}).describe("Edit history for a document");

export const CreateEditRequest = z.object({
  encryptedContent: encrypted.describe("Encrypted edit content (full document snapshot or delta)"),
  encryptedContentIv: iv.describe("IV for the encrypted content"),
  signature: signature.describe("Author's Ed25519 signature over the plaintext content"),
  sequenceNumber: z.number().int().min(0).describe("Monotonically increasing edit sequence number"),
  algorithm,
}).describe("Add a new edit to a document");

export const CreateEditResponse = z.object({
  edit: z.object({
    id: z.string().describe("Newly created edit ID"),
  }),
}).describe("Newly created edit");

export const ShareDocumentRequest = ShareInput.describe(
  "Grant another identity access to this document"
);

export const ShareDocumentResponse = z.object({
  accessGrant: z.object({
    id: z.string().describe("Access grant ID"),
  }),
}).describe("Newly created access grant");

// --- Wiki (slug-addressed documents) ---

export const GetDocumentBySlugResponse = z.object({
  document: z.object({
    id: z.string().describe("Document ID"),
    type: z.enum(["doc", "spreadsheet"]),
    slug: z.string().describe("Document slug"),
    encryptedTitle: encrypted,
    encryptedTitleIv: iv,
    algorithm,
    createdAt: z.string().optional(),
  }),
}).describe("Document resolved by slug");

export const UpsertDocumentBySlugRequest = z.object({
  encryptedTitle: encrypted.describe("Encrypted document title"),
  encryptedTitleIv: iv.describe("IV for the encrypted title"),
  algorithm,
  accessGrant: AccessGrantInput.optional().describe(
    "Access grant for the creator (required on first create, ignored on update)"
  ),
  encryptedContent: encrypted.optional().describe(
    "Encrypted document content — if provided, an edit is appended automatically"
  ),
  encryptedContentIv: iv.optional().describe("IV for the encrypted content"),
  signature: signature.optional().describe("Ed25519 signature over the plaintext content"),
}).describe(
  "Upsert a document by slug. Creates the document if it doesn't exist, " +
  "updates the title if it does. Optionally appends content as an edit in the same call."
);

export const UpsertDocumentBySlugResponse = z.object({
  document: z.object({
    id: z.string().describe("Document ID (stable across upserts)"),
  }),
  created: z.boolean().describe("True if the document was newly created, false if updated"),
}).describe("Upsert result");

// --- Tickets ---

const TicketStatus = z.enum(["open", "in_progress", "closed"]).describe("Ticket status");
const TicketPriority = z.enum(["low", "medium", "high", "urgent"]).describe("Ticket priority");

export const ListTicketsResponse = z.object({
  tickets: z.array(z.object({
    id: z.string(),
    encryptedTitle: encrypted,
    encryptedTitleIv: iv,
    encryptedBody: encrypted,
    encryptedBodyIv: iv,
    status: TicketStatus,
    priority: TicketPriority,
    algorithm,
    createdAt: z.string().optional(),
  })).describe("Tickets the identity has access to"),
}).describe("List of accessible tickets");

export const CreateTicketRequest = z.object({
  encryptedTitle: encrypted.describe("Encrypted ticket title"),
  encryptedTitleIv: iv.describe("IV for the encrypted title"),
  encryptedBody: encrypted.describe("Encrypted ticket body (markdown)"),
  encryptedBodyIv: iv.describe("IV for the encrypted body"),
  status: TicketStatus.optional().default("open"),
  priority: TicketPriority.optional().default("medium"),
  algorithm,
  accessGrant: AccessGrantInput.describe("Access grant for the creator"),
}).describe("Create a new encrypted ticket");

export const CreateTicketResponse = z.object({
  ticket: z.object({
    id: z.string().describe("Newly created ticket ID"),
  }),
}).describe("Newly created ticket");

export const UpdateTicketMetadataRequest = z.object({
  status: TicketStatus.optional(),
  priority: TicketPriority.optional(),
}).refine((d: { status?: string; priority?: string }) => d.status || d.priority, {
  message: "At least one of status or priority must be provided",
}).describe("Update ticket status and/or priority (plaintext fields, no re-encryption needed)");

export const UpdateTicketContentRequest = z.object({
  encryptedTitle: encrypted.describe("Re-encrypted ticket title"),
  encryptedTitleIv: iv.describe("New IV for the encrypted title"),
  encryptedBody: encrypted.describe("Re-encrypted ticket body"),
  encryptedBodyIv: iv.describe("New IV for the encrypted body"),
  algorithm,
}).describe("Replace ticket encrypted content (title + body)");

export const OkResponse = z.object({
  ok: z.literal(true),
}).describe("Success response");

export const ListCommentsResponse = z.object({
  comments: z.array(z.object({
    id: z.string(),
    encryptedContent: encrypted,
    encryptedContentIv: iv,
    signature,
    algorithm,
    authorIdentityId: z.string(),
    createdAt: z.string().optional(),
  })).describe("Ordered list of ticket comments"),
}).describe("Comments for a ticket");

export const CreateCommentRequest = z.object({
  encryptedContent: encrypted.describe("Encrypted comment content"),
  encryptedContentIv: iv.describe("IV for the encrypted content"),
  signature: signature.describe("Author's Ed25519 signature over the plaintext content"),
  algorithm,
}).describe("Add a comment to a ticket");

export const CreateCommentResponse = z.object({
  comment: z.object({
    id: z.string().describe("Newly created comment ID"),
  }),
}).describe("Newly created comment");

export const ShareTicketRequest = ShareInput.describe(
  "Grant another identity access to this ticket"
);

export const ShareTicketResponse = z.object({
  accessGrant: z.object({
    id: z.string().describe("Access grant ID"),
  }),
}).describe("Newly created access grant");

export const AssignTicketRequest = z.object({
  assigneeIdentityId: z.string().describe("Identity ID to assign the ticket to"),
}).describe("Assign a ticket to an identity");

// --- Error ---

export const ErrorResponse = z.object({
  error: z.string().describe("Human-readable error message"),
}).describe("Error response");

// ─── Route Registry ─────────────────────────────────────────────────────────
// The canonical list of every API endpoint with metadata for doc generation.

export type RouteEntry = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  description: string;
  auth: boolean;
  /** Zod schema for request body (undefined for GET) */
  request?: z.ZodTypeAny;
  /** Zod schema for success response */
  response: z.ZodTypeAny;
  /** HTTP status code for success */
  successStatus: number;
  /** Path parameters */
  pathParams?: { name: string; description: string }[];
};

export const routes: RouteEntry[] = [
  // --- Public ---
  {
    method: "GET",
    path: "/health",
    summary: "Health check",
    description: "Returns `{ ok: true }` if the API is running. No authentication required.",
    auth: false,
    response: HealthResponse,
    successStatus: 200,
  },
  {
    method: "POST",
    path: "/register-identity",
    summary: "Register a new identity",
    description:
      "Creates a new cryptographic identity linked to an InstantDB user account. " +
      "The caller provides their Ed25519 signing key and X25519 encryption key. " +
      "No signature auth is required (the user authenticates via InstantDB).",
    auth: false,
    request: RegisterIdentityRequest,
    response: RegisterIdentityResponse,
    successStatus: 200,
  },

  // --- Identities ---
  {
    method: "GET",
    path: "/api/identities/:id",
    summary: "Get identity public info",
    description:
      "Retrieve an identity's public keys and display name. " +
      "Used when sharing a document or ticket with another user.",
    auth: true,
    response: GetIdentityResponse,
    successStatus: 200,
    pathParams: [{ name: "id", description: "Identity ID" }],
  },

  // --- Documents ---
  {
    method: "GET",
    path: "/api/documents",
    summary: "List documents",
    description: "Returns all documents the authenticated identity has access to via access grants.",
    auth: true,
    response: ListDocumentsResponse,
    successStatus: 200,
  },
  {
    method: "POST",
    path: "/api/documents",
    summary: "Create a document",
    description:
      "Creates a new encrypted document (type: doc or spreadsheet). " +
      "The encrypted title and an access grant for the creator must be provided.",
    auth: true,
    request: CreateDocumentRequest,
    response: CreateDocumentResponse,
    successStatus: 201,
  },
  {
    method: "GET",
    path: "/api/documents/:id/edits",
    summary: "List document edits",
    description: "Returns the full edit history for a document, ordered by sequence number.",
    auth: true,
    response: ListEditsResponse,
    successStatus: 200,
    pathParams: [{ name: "id", description: "Document ID" }],
  },
  {
    method: "POST",
    path: "/api/documents/:id/edits",
    summary: "Add a document edit",
    description:
      "Appends a new edit (encrypted content snapshot) to a document's history. " +
      "Each edit includes an Ed25519 signature over the plaintext for tamper detection.",
    auth: true,
    request: CreateEditRequest,
    response: CreateEditResponse,
    successStatus: 201,
    pathParams: [{ name: "id", description: "Document ID" }],
  },
  {
    method: "POST",
    path: "/api/documents/:id/share",
    summary: "Share a document",
    description:
      "Grants another identity access to this document by providing them with " +
      "the document's symmetric key encrypted to their public key.",
    auth: true,
    request: ShareDocumentRequest,
    response: ShareDocumentResponse,
    successStatus: 201,
    pathParams: [{ name: "id", description: "Document ID" }],
  },

  // --- Wiki (slug-addressed documents) ---
  {
    method: "GET",
    path: "/api/documents/by-slug/:slug",
    summary: "Get document by slug",
    description:
      "Resolve a document by its plaintext slug. Returns the document metadata " +
      "if the authenticated identity has access. Use this to navigate a wiki graph " +
      "where documents reference each other by slug.",
    auth: true,
    response: GetDocumentBySlugResponse,
    successStatus: 200,
    pathParams: [{ name: "slug", description: "Document slug (e.g. 'project-roadmap')" }],
  },
  {
    method: "PUT",
    path: "/api/documents/by-slug/:slug",
    summary: "Upsert document by slug",
    description:
      "The primary wiki/agent-memory endpoint. Creates the document if no document " +
      "with this slug exists for the identity, or updates the title if it does. " +
      "Optionally appends an encrypted content edit in the same call. " +
      "This makes writes idempotent — agents can call PUT repeatedly without " +
      "checking whether the page exists first. " +
      "On create, accessGrant is required. On update, it is ignored.",
    auth: true,
    request: UpsertDocumentBySlugRequest,
    response: UpsertDocumentBySlugResponse,
    successStatus: 200,
    pathParams: [{ name: "slug", description: "Document slug (e.g. 'project-roadmap')" }],
  },
  {
    method: "GET",
    path: "/api/documents/by-slug/:slug/edits",
    summary: "List edits by slug",
    description:
      "Returns the full edit history for a slug-addressed document. " +
      "Equivalent to GET /api/documents/:id/edits but resolved via slug.",
    auth: true,
    response: ListEditsResponse,
    successStatus: 200,
    pathParams: [{ name: "slug", description: "Document slug" }],
  },
  {
    method: "POST",
    path: "/api/documents/by-slug/:slug/edits",
    summary: "Add edit by slug",
    description:
      "Append an encrypted content edit to a slug-addressed document. " +
      "Equivalent to POST /api/documents/:id/edits but resolved via slug.",
    auth: true,
    request: CreateEditRequest,
    response: CreateEditResponse,
    successStatus: 201,
    pathParams: [{ name: "slug", description: "Document slug" }],
  },

  // --- Tickets ---
  {
    method: "GET",
    path: "/api/tickets",
    summary: "List tickets",
    description: "Returns all tickets the authenticated identity has access to.",
    auth: true,
    response: ListTicketsResponse,
    successStatus: 200,
  },
  {
    method: "POST",
    path: "/api/tickets",
    summary: "Create a ticket",
    description:
      "Creates a new encrypted ticket with title, body, optional status/priority, " +
      "and an access grant for the creator.",
    auth: true,
    request: CreateTicketRequest,
    response: CreateTicketResponse,
    successStatus: 201,
  },
  {
    method: "PATCH",
    path: "/api/tickets/:id",
    summary: "Update ticket metadata",
    description:
      "Updates a ticket's status and/or priority. These are plaintext fields " +
      "so no re-encryption is needed.",
    auth: true,
    request: UpdateTicketMetadataRequest,
    response: OkResponse,
    successStatus: 200,
    pathParams: [{ name: "id", description: "Ticket ID" }],
  },
  {
    method: "PUT",
    path: "/api/tickets/:id",
    summary: "Update ticket content",
    description:
      "Replaces the ticket's encrypted title and body with new ciphertext.",
    auth: true,
    request: UpdateTicketContentRequest,
    response: OkResponse,
    successStatus: 200,
    pathParams: [{ name: "id", description: "Ticket ID" }],
  },
  {
    method: "GET",
    path: "/api/tickets/:id/comments",
    summary: "List ticket comments",
    description: "Returns all comments for a ticket, ordered by creation time.",
    auth: true,
    response: ListCommentsResponse,
    successStatus: 200,
    pathParams: [{ name: "id", description: "Ticket ID" }],
  },
  {
    method: "POST",
    path: "/api/tickets/:id/comments",
    summary: "Add a ticket comment",
    description:
      "Adds an encrypted comment to a ticket. Includes an Ed25519 signature for authenticity.",
    auth: true,
    request: CreateCommentRequest,
    response: CreateCommentResponse,
    successStatus: 201,
    pathParams: [{ name: "id", description: "Ticket ID" }],
  },
  {
    method: "POST",
    path: "/api/tickets/:id/share",
    summary: "Share a ticket",
    description:
      "Grants another identity access to this ticket by providing them with " +
      "the ticket's symmetric key encrypted to their public key.",
    auth: true,
    request: ShareTicketRequest,
    response: ShareTicketResponse,
    successStatus: 201,
    pathParams: [{ name: "id", description: "Ticket ID" }],
  },
  {
    method: "PATCH",
    path: "/api/tickets/:id/assign",
    summary: "Assign a ticket",
    description: "Assigns a ticket to another identity.",
    auth: true,
    request: AssignTicketRequest,
    response: OkResponse,
    successStatus: 200,
    pathParams: [{ name: "id", description: "Ticket ID" }],
  },
];

// ─── Helpers for doc generation ─────────────────────────────────────────────

/** Recursively extract a JSON-Schema-like shape from a Zod schema for display */
export function zodToJsonShape(schema: z.ZodTypeAny): Record<string, unknown> {
  // Unwrap effects (refine, transform, etc.)
  if (schema instanceof z.ZodEffects) {
    return zodToJsonShape(schema._def.schema);
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(shape)) {
      result[key] = zodFieldToDoc(value as z.ZodTypeAny);
    }
    return result;
  }
  return {};
}

type FieldDoc = {
  type: string;
  description?: string;
  required: boolean;
  enum?: string[];
  default?: unknown;
  properties?: Record<string, FieldDoc>;
  items?: FieldDoc;
};

function zodFieldToDoc(schema: z.ZodTypeAny): FieldDoc {
  const desc = schema._def.description;

  // Unwrap optional/default
  if (schema instanceof z.ZodOptional) {
    const inner = zodFieldToDoc(schema._def.innerType);
    return { ...inner, required: false, description: desc || inner.description };
  }
  if (schema instanceof z.ZodDefault) {
    const inner = zodFieldToDoc(schema._def.innerType);
    return {
      ...inner,
      required: false,
      default: schema._def.defaultValue(),
      description: desc || inner.description,
    };
  }
  if (schema instanceof z.ZodEffects) {
    return zodFieldToDoc(schema._def.schema);
  }

  if (schema instanceof z.ZodString) {
    return { type: "string", description: desc, required: true };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: "number", description: desc, required: true };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean", description: desc, required: true };
  }
  if (schema instanceof z.ZodLiteral) {
    return { type: JSON.stringify(schema._def.value), description: desc, required: true };
  }
  if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      description: desc,
      required: true,
      enum: schema._def.values as string[],
    };
  }
  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      description: desc,
      required: true,
      items: zodFieldToDoc(schema._def.type),
    };
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const props: Record<string, FieldDoc> = {};
    for (const [key, value] of Object.entries(shape)) {
      props[key] = zodFieldToDoc(value as z.ZodTypeAny);
    }
    return { type: "object", description: desc, required: true, properties: props };
  }
  return { type: "unknown", description: desc, required: true };
}

/** Get the flattened field docs for a Zod object schema */
export function getFieldDocs(schema: z.ZodTypeAny): Record<string, FieldDoc> {
  if (schema instanceof z.ZodEffects) {
    return getFieldDocs(schema._def.schema);
  }
  if (schema instanceof z.ZodObject) {
    const result: Record<string, FieldDoc> = {};
    for (const [key, value] of Object.entries(schema.shape)) {
      result[key] = zodFieldToDoc(value as z.ZodTypeAny);
    }
    return result;
  }
  return {};
}
