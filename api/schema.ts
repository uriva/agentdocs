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
const algorithm = z.string().describe(
  "Encryption algorithm identifier (e.g. AES-GCM-256)",
);
/** Base64-encoded Ed25519 signature */
const signature = z.string().describe("Base64-encoded Ed25519 signature");

// ─── Shared sub-schemas ─────────────────────────────────────────────────────

const AccessGrantInput = z.object({
  encryptedSymmetricKey: encrypted.describe(
    "Document symmetric key, encrypted for the grantee",
  ),
  iv: iv.describe("IV used when encrypting the symmetric key"),
  salt: z.string().describe("Salt used in key derivation"),
  algorithm,
}).describe("Access grant: encrypted symmetric key bundle for a recipient");

const ShareInput = z.object({
  granteeIdentityId: z.string().describe("Identity ID of the recipient"),
  encryptedSymmetricKey: encrypted.describe(
    "Document symmetric key, encrypted for the grantee",
  ),
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
  signingPublicKey: z.string().describe(
    "Base64-encoded Ed25519 signing public key",
  ),
  encryptionPublicKey: z.string().describe(
    "Base64-encoded X25519 encryption public key",
  ),
  name: z.string().optional().describe("Human-readable display name"),
  algorithmSuite: z.string().describe(
    "Algorithm suite identifier (e.g. Ed25519-X25519-AES256GCM)",
  ),
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
    signingPublicKey: z.string().describe(
      "Base64-encoded Ed25519 signing public key",
    ),
    encryptionPublicKey: z.string().describe(
      "Base64-encoded X25519 encryption public key",
    ),
    name: z.string().describe("Display name"),
    algorithmSuite: z.string().describe("Algorithm suite identifier"),
  }),
}).describe("Identity public information");

// --- Documents ---

export const ListDocumentsResponse = z.object({
  documents: z.array(z.object({
    id: z.string(),
    algorithm,
    encryptedSnapshot: encrypted,
    encryptedSnapshotIv: iv,
    snapshotHash: z.string().describe("SHA-256 hash of latest plaintext snapshot"),
    snapshotSequenceNumber: z.number().describe(
      "Sequence number of latest encrypted snapshot",
    ),
    createdAt: z.string().optional(),
  })).describe("Documents the identity has access to"),
}).describe("List of accessible documents");

export const GetDocumentResponse = z.object({
  document: z.object({
    id: z.string(),
    algorithm,
    encryptedSnapshot: encrypted,
    encryptedSnapshotIv: iv,
    snapshotHash: z.string().describe("SHA-256 hash of latest plaintext snapshot"),
    snapshotSequenceNumber: z.number().describe(
      "Sequence number of latest encrypted snapshot",
    ),
    createdAt: z.string().optional(),
    accessGrants: z.array(z.unknown()).describe(
      "Access grants the caller can use to derive the document key",
    ),
  }),
}).describe("Single document with the caller's access grants");

export const CreateDocumentRequest = z.object({
  algorithm,
  encryptedSnapshot: encrypted.describe("Encrypted initial full JSON snapshot"),
  encryptedSnapshotIv: iv.describe("IV for the encrypted initial snapshot"),
  snapshotHash: z.string().describe("SHA-256 hash of initial plaintext snapshot"),
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
    encryptedPatch: encrypted,
    encryptedPatchIv: iv,
    signature,
    sequenceNumber: z.number(),
    baseSequenceNumber: z.number().describe(
      "Snapshot sequence this patch was based on",
    ),
    resultingSnapshotHash: z.string().describe(
      "SHA-256 hash of plaintext snapshot after applying patch",
    ),
    algorithm,
    authorIdentityId: z.string(),
    createdAt: z.string().optional(),
  })).describe("Ordered list of document edits"),
}).describe("Edit history for a document");

export const CreateEditRequest = z.object({
  encryptedPatch: encrypted.describe(
    "Encrypted incremental patch payload",
  ),
  encryptedPatchIv: iv.describe("IV for the encrypted patch"),
  signature: signature.describe(
    "Author's Ed25519 signature over the plaintext patch",
  ),
  baseSequenceNumber: z.number().int().min(0).describe(
    "Current snapshot sequence expected by this patch",
  ),
  sequenceNumber: z.number().int().min(0).describe(
    "Next sequence number after applying this patch",
  ),
  resultingSnapshotHash: z.string().describe(
    "SHA-256 hash of resulting plaintext snapshot",
  ),
  encryptedResultingSnapshot: encrypted.describe(
    "Encrypted resulting full snapshot for fast latest reads",
  ),
  encryptedResultingSnapshotIv: iv.describe(
    "IV for the encrypted resulting full snapshot",
  ),
  algorithm,
}).describe("Add a new edit to a document");

export const CreateEditResponse = z.object({
  edit: z.object({
    id: z.string().describe("Newly created edit ID"),
  }),
}).describe("Newly created edit");

export const ShareDocumentRequest = ShareInput.describe(
  "Grant another identity access to this document",
);

export const ShareDocumentResponse = z.object({
  accessGrant: z.object({
    id: z.string().describe("Access grant ID"),
  }),
}).describe("Newly created access grant");

export const OkResponse = z.object({
  ok: z.literal(true),
}).describe("Success response");

// --- Webhooks ---

const WebhookEventType = z.enum([
  "document.edited",
  "document.shared",
]).describe("Event type to subscribe to");

const ResourceType = z.enum(["document"]).describe("Resource type");

export const CreateWebhookRequest = z.object({
  url: z.string().url().describe("HTTPS URL to receive webhook POST requests"),
  resourceType: ResourceType,
  resourceId: z.string().describe("ID of the document to watch"),
  events: z.array(WebhookEventType).min(1).describe(
    "Event types to subscribe to",
  ),
}).describe("Subscribe to real-time events for a document");

export const CreateWebhookResponse = z.object({
  webhook: z.object({
    id: z.string().describe("Webhook subscription ID"),
    secret: z.string().describe(
      "HMAC-SHA256 signing secret. Store this securely — it is only returned once. " +
        "Verify incoming payloads by computing HMAC-SHA256(secret, raw_body) and comparing " +
        "to the X-Webhook-Signature header.",
    ),
  }),
}).describe("Newly created webhook subscription");

export const ListWebhooksResponse = z.object({
  webhooks: z.array(z.object({
    id: z.string(),
    url: z.string(),
    resourceType: ResourceType,
    resourceId: z.string(),
    events: z.array(WebhookEventType),
    active: z.boolean().describe(
      "Whether the webhook is active (disabled after repeated failures)",
    ),
    createdAt: z.string().optional(),
  })).describe("Webhook subscriptions for the authenticated identity"),
}).describe("List of webhook subscriptions");

export const DeleteWebhookResponse = z.object({
  ok: z.literal(true),
}).describe("Webhook deleted");

export const WebhookPayloadSchema = z.object({
  event: WebhookEventType,
  resourceType: ResourceType,
  resourceId: z.string().describe("ID of the affected document"),
  actorIdentityId: z.string().describe("Identity that triggered the event"),
  timestamp: z.string().describe("ISO 8601 timestamp of the event"),
  data: z.record(z.unknown()).optional().describe(
    "Optional plaintext metadata. " +
      "Never contains encrypted content — fetch via the API to decrypt.",
  ),
}).describe(
  "Webhook payload delivered via POST. Verify authenticity using the " +
    "X-Webhook-Signature header (HMAC-SHA256 of the raw JSON body with your secret).",
);

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
    description:
      "Returns `{ ok: true }` if the API is running. No authentication required.",
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
    description: "Retrieve an identity's public keys and display name. " +
      "Used when sharing a document with another user.",
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
    description:
      "Returns all documents the authenticated identity has access to via access grants.",
    auth: true,
    response: ListDocumentsResponse,
    successStatus: 200,
  },
  {
    method: "GET",
    path: "/api/documents/:id",
    summary: "Get a document",
    description:
      "Returns a single document with the caller's access grants. 404 if the " +
      "caller has no grant on this document.",
    auth: true,
    response: GetDocumentResponse,
    successStatus: 200,
    pathParams: [{ name: "id", description: "Document ID" }],
  },
  {
    method: "POST",
    path: "/api/documents",
    summary: "Create a document",
    description:
      "Creates a new encrypted document with an initial full snapshot and access grant for the creator.",
    auth: true,
    request: CreateDocumentRequest,
    response: CreateDocumentResponse,
    successStatus: 201,
  },
  {
    method: "GET",
    path: "/api/documents/:id/edits",
    summary: "List document edits",
    description:
      "Returns the full edit history for a document, ordered by sequence number.",
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
      "Appends an incremental encrypted patch and atomically updates the latest encrypted snapshot. " +
      "Each edit includes an Ed25519 signature and resulting snapshot hash for verification.",
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
  // --- Webhooks ---
  {
    method: "GET",
    path: "/api/webhooks",
    summary: "List webhook subscriptions",
    description:
      "Returns all webhook subscriptions owned by the authenticated identity.",
    auth: true,
    response: ListWebhooksResponse,
    successStatus: 200,
  },
  {
    method: "POST",
    path: "/api/webhooks",
    summary: "Create a webhook subscription",
    description: "Subscribe to real-time events for a specific document. " +
      "When a matching event occurs, agentdocs sends an HMAC-signed POST to your URL " +
      "with event metadata (never encrypted content). " +
      "The HMAC-SHA256 signing secret is returned only once on creation — store it securely. " +
      "Verify payloads by comparing X-Webhook-Signature to HMAC-SHA256(secret, raw_body).",
    auth: true,
    request: CreateWebhookRequest,
    response: CreateWebhookResponse,
    successStatus: 201,
  },
  {
    method: "DELETE",
    path: "/api/webhooks/:id",
    summary: "Delete a webhook subscription",
    description:
      "Permanently removes a webhook subscription. Deliveries in flight may still complete.",
    auth: true,
    response: DeleteWebhookResponse,
    successStatus: 200,
    pathParams: [{ name: "id", description: "Webhook subscription ID" }],
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
    return {
      ...inner,
      required: false,
      description: desc || inner.description,
    };
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
    return {
      type: JSON.stringify(schema._def.value),
      description: desc,
      required: true,
    };
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
    return {
      type: "object",
      description: desc,
      required: true,
      properties: props,
    };
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
