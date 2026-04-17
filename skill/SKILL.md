---
name: agentdocs
description: Use when an AI agent needs to store, retrieve, or share end-to-end encrypted documents. Triggers on requests like "save this document", "store my notes", "encrypted storage", or any task requiring persistent encrypted content that agents and humans can collaborate on.
---

# agentdocs — Encrypted Documents for AI Agents

agentdocs is an end-to-end encrypted document platform. All content (titles,
bodies, edits) is encrypted client-side with AES-256-GCM. The server never
sees plaintext. Keys are exchanged via X25519 key agreement, and every edit
is signed with Ed25519 for tamper detection.

This skill bundles a set of safescript files — one per operation — that
handle the crypto and HTTP end-to-end. Agents invoke the scripts; they do
not implement the crypto themselves.

API base URL: `https://agentdocs-api.uriva.deno.net`
safescript language: https://safescript.dev

## Step 1 — Get an identity from the user

Agents do not generate identities. Ask the user to create one in the web UI
and export it to you:

1. Direct them to **https://agentdocs.dev** and have them sign in.
2. Tell them to click "Create identity" (or pick an existing one), then
   "Export."
3. The app shows a long base64url string — the **exported identity bundle**.
   It contains the identity `id` plus the Ed25519 signing private key and
   X25519 encryption private key.
4. Ask them to paste it to you. Warn them that anyone holding this string
   can read and modify every document the identity has access to.
5. Save it as a secret named **`agentdocs-identity`**. This is the single
   secret every script in this bundle reads.

### Bundle shape

```json
{
  "id": "<identity UUID from server>",
  "name": "<display name>",
  "signing":    { "privateKey": "<base64url PKCS8 Ed25519 private key>" },
  "encryption": { "privateKey": "<base64url PKCS8 X25519 private key>" },
  "algorithm":  { "signing": "Ed25519",
                  "keyExchange": "X25519",
                  "symmetric": "AES-GCM-256" }
}
```

The bundle is itself base64url-encoded JSON. The scripts handle decoding.
Public keys are derived at runtime from the private keys (no need for the
bundle to carry them).

### Giving the agent access to existing documents

If the user already has documents and wants the agent to read or edit them,
they share each document **with the agent's identity id** from the web UI.
Sharing attaches a new access grant — the document ciphertext is not
re-encrypted. The user can find the agent's id inside the exported bundle
(the `id` field) or decoded via `echo "<bundle>" | base64 -d`.

## Step 2 — Use the scripts

Each file in this directory implements one operation end-to-end. They all
read the `agentdocs-identity` secret, sign their API calls, and handle
the crypto internally. Call them as safescript scripts from your agent.

| Script                  | Purpose                                          |
|-------------------------|--------------------------------------------------|
| `create-document.ss`    | Create a new encrypted document with initial content |
| `add-edit.ss`           | Append a new encrypted content edit              |
| `rename-document.ss`    | Change the document's title                      |
| `share-document.ss`     | Grant another identity read access               |
| `list-documents.ss`     | List all accessible docs, decrypted titles only  |
| `get-document.ss`       | Fetch one doc by id with decrypted title+content |
| `search-documents.ss`   | List all docs with decrypted titles + content (filter client-side) |

### Script signatures

Each script exports a single top-level function with these parameters:

```
createDocument(title: string, content: string)
  → { documentId, documentKey, status, body }

addEdit(documentId: string, documentKey: string, newContent: string)
  → { status, body, sequenceNumber }

renameDocument(documentId: string, documentKey: string, newTitle: string)
  → { status, body }

shareDocument(documentId: string, documentKey: string, granteeIdentityId: string)
  → { status, body }

listDocuments()
  → { documents: [{ documentId, title, documentKey }] }

getDocument(documentId: string)
  → { documentId, title, content, documentKey, sequenceNumber }

searchDocuments()
  → { documents: [{ documentId, title, content, documentKey }] }
```

### The `documentKey` field

`createDocument` returns a `documentKey` — the AES-256-GCM key that encrypts
the document. Keep it. You need it again to `addEdit`, `rename`, or `share`.

If you don't have it (fresh session, or someone else created the doc and
shared it), use `listDocuments` or `getDocument` — both re-derive and
return the key from the access grant automatically.

### Searching

`searchDocuments` returns every accessible doc's full decrypted title and
content. The server sees none of the plaintext. Your agent filters these
results locally against whatever query the user asked about — that's the
only reasonable place to do case-insensitive / fuzzy / LLM-graded matching
because safescript has no closures and can't thread a query into a
`map` callback.

In practice: feed the decrypted titles+contents into the model's context
and let it pick, or run a simple `string.includes` in your agent code.

### Scale

All "multi-doc" scripts (`list`, `search`) fetch every accessible doc and
decrypt them locally. This works up to low thousands of documents per
identity. For larger corpora a dedicated encrypted-search-index scheme
would be needed — not shipped today.

## Permission surface (per-script)

Each script's static analysis (via `safescript compute-signature`):

- `secrets read`: `agentdocs-identity`
- `hosts`: `agentdocs-api.uriva.deno.net`
- `env`: `timestamp` (all), `randomBytes` (only `create-document` and
  `share-document` — new access grants need fresh IVs and salts)

No secrets are written. No other hosts are contacted. No filesystem access.

## What the scripts don't cover

- **Tickets** (`/api/tickets`) — same crypto model, not yet in this bundle.
- **Webhooks** (`/api/webhooks`) — plaintext metadata, subscribe to
  document events. Simple signed HTTP.
- **Key rotation** — not yet an API concept. Revoking access today deletes
  the grant but the former grantee may still hold `K`; real revocation
  needs to rotate `K` and re-encrypt content, which no endpoint currently
  exposes.

## Low-level API reference

If you need to call endpoints the scripts don't wrap, all `/api/*`
endpoints require these headers:

- `X-Identity-Id`: the identity's UUID (from the exported bundle)
- `X-Timestamp`: current Unix time in milliseconds, as a decimal string
- `X-Signature`: base64url Ed25519 signature over
  `${METHOD}\n${PATH}\n${TIMESTAMP}\n${SHA256(BODY)}` — use empty string
  for BODY on GET / HEAD.

See `llms.txt` at the repo root for the full endpoint list and request
shapes.
