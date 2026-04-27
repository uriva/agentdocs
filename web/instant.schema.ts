import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),
    identities: i.entity({
      signingPublicKey: i.string(),
      encryptionPublicKey: i.string(),
      name: i.string().optional(),
      algorithmSuite: i.string(),
      createdAt: i.number(),
    }),
    documents: i.entity({
      algorithm: i.string(),
      encryptedSnapshot: i.string(),
      encryptedSnapshotIv: i.string(),
      snapshotHash: i.string(),
      snapshotSequenceNumber: i.number().indexed(),
      createdAt: i.number(),
    }),
    edits: i.entity({
      encryptedPatch: i.string(),
      encryptedPatchIv: i.string(),
      signature: i.string(),
      sequenceNumber: i.number().indexed(),
      baseSequenceNumber: i.number(),
      resultingSnapshotHash: i.string(),
      algorithm: i.string(),
      createdAt: i.number(),
    }),
    accessGrants: i.entity({
      encryptedSymmetricKey: i.string(),
      iv: i.string(),
      salt: i.string(),
      algorithm: i.string(),
      createdAt: i.number(),
    }),
  },
  links: {
    identityOwner: {
      forward: { on: "identities", has: "one", label: "owner" },
      reverse: { on: "$users", has: "many", label: "identities" },
    },
    editDocument: {
      forward: { on: "edits", has: "one", label: "document" },
      reverse: { on: "documents", has: "many", label: "edits" },
    },
    editAuthor: {
      forward: { on: "edits", has: "one", label: "author" },
      reverse: { on: "identities", has: "many", label: "edits" },
    },
    grantDocument: {
      forward: { on: "accessGrants", has: "one", label: "document" },
      reverse: { on: "documents", has: "many", label: "accessGrants" },
    },
    grantIdentity: {
      forward: { on: "accessGrants", has: "one", label: "grantee" },
      reverse: { on: "identities", has: "many", label: "accessGrants" },
    },
    grantGrantor: {
      forward: { on: "accessGrants", has: "one", label: "grantor" },
      reverse: { on: "identities", has: "many", label: "grantsGiven" },
    },
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
