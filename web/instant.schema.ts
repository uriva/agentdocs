import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),
    identities: i.entity({
      // Public keys (base64url-encoded)
      signingPublicKey: i.string(),
      encryptionPublicKey: i.string(),
      // Human-readable label (plaintext, optional)
      name: i.string().optional(),
      // Algorithm suite identifier for future upgrades
      algorithmSuite: i.string(),
      createdAt: i.number(),
    }),
    documents: i.entity({
      // "doc" | "spreadsheet"
      type: i.string(),
      // Title encrypted with the document's symmetric key
      encryptedTitle: i.string(),
      encryptedTitleIv: i.string(),
      // Algorithm used for encryption
      algorithm: i.string(),
      createdAt: i.number(),
    }),
    edits: i.entity({
      // Content encrypted with the document's symmetric key
      encryptedContent: i.string(),
      encryptedContentIv: i.string(),
      // Ed25519 signature of the encrypted content by the author
      signature: i.string(),
      // Monotonically increasing per document
      sequenceNumber: i.number().indexed(),
      // Algorithm used
      algorithm: i.string(),
      createdAt: i.number(),
    }),
    accessGrants: i.entity({
      // Document symmetric key encrypted via ECDH(grantor, grantee)
      encryptedSymmetricKey: i.string(),
      iv: i.string(),
      salt: i.string(),
      // Algorithm suite used for the grant
      algorithm: i.string(),
      createdAt: i.number(),
    }),
    tickets: i.entity({
      // E2EE fields
      encryptedTitle: i.string(),
      encryptedTitleIv: i.string(),
      encryptedBody: i.string(),
      encryptedBodyIv: i.string(),
      // Plaintext metadata (for server-side filtering)
      status: i.string().indexed(), // "open" | "in_progress" | "closed"
      priority: i.string().indexed(), // "low" | "medium" | "high" | "urgent"
      // Algorithm used for encryption
      algorithm: i.string(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),
    ticketComments: i.entity({
      // Content encrypted with the ticket's symmetric key
      encryptedContent: i.string(),
      encryptedContentIv: i.string(),
      // Ed25519 signature of the encrypted content
      signature: i.string(),
      // Algorithm used
      algorithm: i.string(),
      createdAt: i.number(),
    }),
  },
  links: {
    // An identity belongs to a $user (for billing)
    identityOwner: {
      forward: { on: "identities", has: "one", label: "owner" },
      reverse: { on: "$users", has: "many", label: "identities" },
    },
    // An edit belongs to a document
    editDocument: {
      forward: { on: "edits", has: "one", label: "document" },
      reverse: { on: "documents", has: "many", label: "edits" },
    },
    // An edit was authored by an identity
    editAuthor: {
      forward: { on: "edits", has: "one", label: "author" },
      reverse: { on: "identities", has: "many", label: "edits" },
    },
    // An access grant links a document to an identity (grantee)
    grantDocument: {
      forward: { on: "accessGrants", has: "one", label: "document" },
      reverse: { on: "documents", has: "many", label: "accessGrants" },
    },
    grantIdentity: {
      forward: { on: "accessGrants", has: "one", label: "grantee" },
      reverse: { on: "identities", has: "many", label: "accessGrants" },
    },
    // Track who granted access (so recipient knows which public key to use for ECDH)
    grantGrantor: {
      forward: { on: "accessGrants", has: "one", label: "grantor" },
      reverse: { on: "identities", has: "many", label: "grantsGiven" },
    },
    // A document was created by an identity
    documentCreator: {
      forward: { on: "documents", has: "one", label: "creator" },
      reverse: { on: "identities", has: "many", label: "createdDocuments" },
    },
    // ── Ticket links ──────────────────────────────────────────────
    // A ticket was created by an identity
    ticketCreator: {
      forward: { on: "tickets", has: "one", label: "creator" },
      reverse: { on: "identities", has: "many", label: "createdTickets" },
    },
    // A ticket is assigned to an identity (optional)
    ticketAssignee: {
      forward: { on: "tickets", has: "one", label: "assignee" },
      reverse: { on: "identities", has: "many", label: "assignedTickets" },
    },
    // Access grants can also be linked to tickets
    grantTicket: {
      forward: { on: "accessGrants", has: "one", label: "ticket" },
      reverse: { on: "tickets", has: "many", label: "accessGrants" },
    },
    // A comment belongs to a ticket
    commentTicket: {
      forward: { on: "ticketComments", has: "one", label: "ticket" },
      reverse: { on: "tickets", has: "many", label: "comments" },
    },
    // A comment was authored by an identity
    commentAuthor: {
      forward: { on: "ticketComments", has: "one", label: "author" },
      reverse: { on: "identities", has: "many", label: "ticketComments" },
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
