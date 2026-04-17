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
      // Algorithm used for encryption
      algorithm: i.string(),
      // Latest encrypted full snapshot for fast reads
      encryptedSnapshot: i.string(),
      encryptedSnapshotIv: i.string(),
      // Hash of latest plaintext snapshot (for optional verification)
      snapshotHash: i.string(),
      // Latest sequence number represented by encryptedSnapshot
      snapshotSequenceNumber: i.number().indexed(),
      createdAt: i.number(),
    }),
    edits: i.entity({
      // Incremental patch encrypted with the document's symmetric key
      encryptedPatch: i.string(),
      encryptedPatchIv: i.string(),
      // Ed25519 signature of the encrypted content by the author
      signature: i.string(),
      // Monotonically increasing per document (next sequence)
      sequenceNumber: i.number().indexed(),
      // Sequence this patch is based on
      baseSequenceNumber: i.number(),
      // Hash of plaintext snapshot after applying patch
      resultingSnapshotHash: i.string(),
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
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
