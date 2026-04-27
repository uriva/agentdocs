export const permissions = {
  documents: {
    allow: { read: "auth != null" },
  },
  edits: {
    allow: { read: "auth != null" },
  },
  accessGrants: {
    allow: { read: "auth != null" },
  },
  identities: {
    allow: { read: "auth != null" },
  },
};
