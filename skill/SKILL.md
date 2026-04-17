---
name: agentdocs
description: Use when an AI agent needs to store, retrieve, or share end-to-end encrypted JSON documents. Triggers on requests like "save this", "store memory", "encrypted storage", "track tasks as docs", or any task requiring persistent encrypted content that agents and humans can collaborate on.
---

# agentdocs — Encrypted JSON Documents for AI Agents

agentdocs is an end-to-end encrypted document platform. All user content lives
inside encrypted JSON snapshots appended as document edits. The server stores
only ciphertext and cannot read titles, bodies, ticket state, or any other
domain metadata.

This skill bundles safescript files — one per operation — that handle crypto
and signed HTTP requests end-to-end.

API base URL: `https://agentdocs-api.uriva.deno.net`
safescript language: https://safescript.dev

## Step 1 — Get an identity from the user

Agents do not generate identities. Ask the user to create one in the web UI
and export it:

1. Open **https://agentdocs.dev** and sign in.
2. Create or choose an identity and click **Export**.
3. Copy the base64url exported bundle.
4. Save it as secret **`agentdocs-identity`**.

Bundle shape (decoded JSON):

```json
{
  "id": "<identity UUID>",
  "name": "<display name>",
  "signing": { "privateKey": "<base64url PKCS8 Ed25519 private key>" },
  "encryption": { "privateKey": "<base64url PKCS8 X25519 private key>" },
  "algorithm": {
    "signing": "Ed25519",
    "keyExchange": "X25519",
    "symmetric": "AES-GCM-256"
  }
}
```

## Step 2 — Use the scripts

| Script                | Purpose |
|-----------------------|---------|
| `create-document.ss`  | Create a document + initial JSON snapshot edit |
| `add-edit.ss`         | Append a new JSON snapshot edit |
| `share-document.ss`   | Grant another identity access |
| `list-documents.ss`   | Return decrypted latest snapshot per doc |
| `get-document.ss`     | Return one decrypted latest snapshot |
| `search-documents.ss` | Return all decrypted latest snapshots |

`rename-document.ss` was removed. To rename, append a new snapshot with updated
`title`.

### Script signatures

```
createDocument(title: string, content: string)
  -> { documentId, documentKey, status, body }

addEdit(documentId: string, documentKey: string, newSnapshotJson: string)
  -> { status, body, sequenceNumber }

shareDocument(documentId: string, documentKey: string, granteeIdentityId: string)
  -> { status, body }

listDocuments()
  -> { documents: [{ documentId, kind, title, content, documentKey }] }

getDocument(documentId: string)
  -> { documentId, kind, title, content, documentKey, sequenceNumber }

searchDocuments()
  -> { documents: [{ documentId, kind, title, content, documentKey }] }
```

## JSON-first model (everything is a document)

The platform has one primitive: encrypted document snapshots.

- A note/spec doc is a JSON snapshot.
- A ticket is a JSON snapshot with ticket fields.
- A spreadsheet is a JSON snapshot with `kind: "spreadsheet"` and `data`.

Recommended conventions are documented in:

- `skill/conventions/doc.md`
- `skill/conventions/ticket.md`
- `skill/conventions/spreadsheet.md`

## Searching

`searchDocuments` decrypts every accessible latest snapshot and returns them.
Your agent filters locally (substring, embeddings, LLM ranking, etc.).

## Permission surface

All scripts:

- `secrets read`: `agentdocs-identity`
- `hosts`: `agentdocs-api.uriva.deno.net`
- `env`: `timestamp` (all), `randomBytes` (create/share grant flows)

## What scripts do not cover

- Webhook lifecycle (`/api/webhooks`) is not wrapped here.
- Key rotation / hard revocation is not implemented by API.
