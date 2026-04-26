---
name: agentdocs
description: Use when an AI agent needs to store, retrieve, or share end-to-end encrypted JSON documents. Triggers on requests like "save this", "store memory", "encrypted storage", "track tasks as docs", or any task requiring persistent encrypted content that agents and humans can collaborate on.
---

# agentdocs — Encrypted JSON Documents for AI Agents

agentdocs is an end-to-end encrypted document platform. It uses a hybrid model:
- latest full encrypted snapshot stored on the document row for fast reads
- append-only encrypted incremental patches as the edit history

The server stores only ciphertext and cannot read titles, bodies, ticket
state, or any other domain metadata.

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
| `create-document.ss`  | Create a document with initial snapshot + first patch |
| `add-edit.ss`         | Append encrypted patch and update checkpoint snapshot |
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

## How agents should modify documents

Edits are incremental patches. The latest full snapshot is also stored as a
checkpoint on the document for fast reads.

Recommended update flow:

1. Read current state with `getDocument(documentId)`.
2. Parse `content` as JSON if `kind` is not enough, or use known convention.
3. Apply changes in memory.
4. Build the new full snapshot JSON.
5. Call `addEdit(...)` which sends a `replace_snapshot` patch and updates the
   encrypted checkpoint snapshot atomically.

### Example: rename a doc

Read the latest snapshot, change `title`, keep everything else, then append:

```json
{
  "kind": "doc",
  "title": "New Title",
  "content": "...existing content..."
}
```

### Example: update ticket status

```json
{
  "kind": "ticket",
  "title": "Fix auth timeout",
  "content": "Description and acceptance criteria",
  "status": "in_progress",
  "priority": "high",
  "assigneeIdentityId": "<identity-id>",
  "labels": ["bug", "auth"],
  "comments": [
    {
      "authorIdentityId": "<identity-id>",
      "timestamp": "2026-04-17T12:34:56.000Z",
      "content": "Investigating token refresh path"
    }
  ]
}
```

Important: preserve fields you are not changing. Current patch type is
`replace_snapshot`, so dropping a field means deleting it.

## JSON-first model (everything is a document)

The platform has one primitive: encrypted document snapshots, with patch-based
history.

- A note/spec doc is a JSON snapshot.
- A ticket is a JSON snapshot with ticket fields.
- A spreadsheet is a JSON snapshot with `kind: "spreadsheet"` and `data`.

Recommended conventions are documented in:

- `conventions/doc.md`
- `conventions/ticket.md`
- `conventions/spreadsheet.md`

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
