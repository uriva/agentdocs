---
name: agentdocs
description: Use when an AI agent needs to store, retrieve, or share end-to-end encrypted documents, spreadsheets, or tickets. Triggers on requests like "save this document", "create a ticket", "store my notes", "encrypted storage", or any task requiring persistent encrypted content that agents and humans can collaborate on.
---

# agentdocs — Encrypted Documents for AI Agents

agentdocs is an end-to-end encrypted document platform. All content (titles,
bodies, edits, comments) is encrypted client-side with AES-256-GCM. The server
never sees plaintext. Keys are exchanged via X25519 key agreement, and all edits
are signed with Ed25519 for tamper detection.

Base URL: `https://agentdocs-api.uriva.deno.net`

The reference crypto implementation lives in the `@agentdocs/crypto` npm
package — use it instead of reimplementing the primitives.

## Identity — how the agent gets one

Agents do not generate their own identities. An agent uses an identity that was
created by a human user, who exports it and hands the secret to the agent. This
keeps key generation inside a trusted browser environment and gives the user a
clear mental model of what the agent can access.

### The handoff flow

1. **Ask the user to go to https://agentdocs.dev and sign in.**
2. In the app, the user clicks "Create identity" (or picks an existing one),
   then "Export." The app shows a long base64url string — the exported identity
   bundle. It contains the identity's `id`, `name`, and the two private keys
   (Ed25519 signing + X25519 encryption). The public keys are derivable from
   the private keys.
3. **Ask the user to paste that string to you.** Warn them: anyone holding this
   string can read and modify every document the identity has access to.
4. **Store it in your secrets manager** under a name like `agentdocs-identity`.
   Never write it to logs, filesystem, or memory beyond what's needed.
5. On every run, read the secret, call `importIdentity()` from
   `@agentdocs/crypto` to expand it into a usable key pair, and use the
   identity's `id` as the `X-Identity-Id` header for every API call.

### What the exported bundle looks like

A base64url-encoded JSON blob with this shape:

```json
{
  "id": "<identity UUID from server>",
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

### If the user has no identity yet

Direct them to https://agentdocs.dev, tell them to sign in with their email,
click "Create identity", give it a name (e.g. "my-coding-agent"), then export.
Tell them the export action produces a string they should treat like a
password — once it's shared, access cannot be revoked without rotating the
identity entirely.

### If the agent needs write access to a user's existing documents

The user must **share** those documents from the web UI to the agent's
identity, or export an identity that already has access. There is no
server-side "link these two identities" operation — sharing happens
per-document via `POST /api/documents/:id/share` (see Sharing below).

## Authentication

Every `/api/*` request must carry three headers:

- `X-Identity-Id`: the identity's UUID (from the exported bundle)
- `X-Timestamp`: current Unix time in milliseconds, as a decimal string
- `X-Signature`: base64url Ed25519 signature over
  `METHOD\nPATH\nTIMESTAMP\nSHA256(BODY)`

Where `BODY` is the raw JSON request body (or empty string for GET / HEAD).
Requests with timestamps skewed more than a few minutes are rejected.

`@agentdocs/crypto` provides `signRequest(method, path, timestamp, body,
signingPrivateKey)` which returns the signature string directly.

## Crypto model

1. Each identity has an Ed25519 signing keypair + an X25519 encryption keypair.
2. Each document has its own AES-256-GCM symmetric key generated at creation.
3. The document key is wrapped into an **access grant** — one per recipient —
   by deriving a shared key from ECDH(my X25519 private key, recipient's X25519
   public key) and using it to AES-GCM-encrypt the document key.
4. A self-grant is created when the doc is first created: the grantor and the
   grantee are both the creator.
5. Sharing = creating a new access grant that wraps the same document key for
   another identity's public key. The document ciphertext is not re-encrypted.
6. Every content edit is signed with the author's Ed25519 key over the
   plaintext so other members can verify authenticity.

All keys and ciphertext on the wire are base64url strings.

## Documents

Documents are addressed by their server-generated `id`. Agents must keep track
of IDs they create and the AES keys that decrypt them. There are no slugs,
wiki paths, or upserts-by-name. Titles can change freely without breaking
cross-document links.

### Creating a document

High-level steps (each step corresponds to a function in `@agentdocs/crypto`):

1. `generateDocumentKey()` → returns a fresh base64url AES-256-GCM key `K`.
2. `symmetricEncrypt(titleText, K)` → `{ ciphertext, iv }` for the title.
3. `createAccessGrant(K, myEncryptionPrivateKey, myEncryptionPublicKey)` →
   `{ encryptedSymmetricKey, iv, salt, algorithm }`. This is the self-grant.
4. `signRequest("POST", "/api/documents", timestamp, body, signingPrivateKey)`
   to build the auth header.
5. POST to the API:

```
POST /api/documents
X-Identity-Id: <identity.id>
X-Timestamp: <timestamp>
X-Signature: <signature>
Content-Type: application/json

{
  "type": "doc",
  "encryptedTitle": "<ciphertext>",
  "encryptedTitleIv": "<iv>",
  "algorithm": "AES-GCM-256",
  "accessGrant": {
    "encryptedSymmetricKey": "<wrapped doc key>",
    "iv": "<grant iv>",
    "salt": "<grant salt>",
    "algorithm": "AES-GCM-256"
  }
}
```

Response: `{ "document": { "id": "<docId>" } }`

**Persist the `docId` and the document key `K`**. Without `K`, even you can't
decrypt the document later. A common pattern is to stash `{ docId: K }` in your
secrets manager under a single `agentdocs-doc-keys` secret, or to re-derive `K`
each time from the access grant (see "Recovering a document key" below).

### Adding an edit

An edit is a new encrypted content snapshot appended to the doc's history.

1. Recover the document key `K` (either from your own storage, or by calling
   `decryptAccessGrant` on your own access grant — see below).
2. `symmetricEncrypt(newContent, K)` → `{ ciphertext, iv }`.
3. `sign(newContent, signingPrivateKey)` → signature over the plaintext.
4. Fetch the existing edits to pick the next `sequenceNumber`:

```
GET /api/documents/:id/edits
```

5. POST the new edit:

```
POST /api/documents/:id/edits
{
  "encryptedContent": "<ciphertext>",
  "encryptedContentIv": "<iv>",
  "signature": "<base64url Ed25519 signature>",
  "sequenceNumber": <next seq, starting at 0>,
  "algorithm": "AES-GCM-256"
}
```

### Renaming a document

```
PATCH /api/documents/:id
{
  "encryptedTitle": "<new ciphertext>",
  "encryptedTitleIv": "<new iv>",
  "algorithm": "AES-GCM-256"
}
```

The server also records a title-type edit in the history so the rename is
auditable.

### Recovering a document key from an access grant

When you list documents (`GET /api/documents`), each one comes back with the
access grants that apply to your identity. Each grant includes
`encryptedSymmetricKey`, `iv`, `salt`, and a `grantor` identity ID.

1. `GET /api/identities/:grantorId` to fetch the grantor's `encryptionPublicKey`.
2. `decryptAccessGrant(grant, myEncryptionPrivateKey, grantorEncryptionPublicKey)`
   → the document's AES key `K`.

`K` is stable for the life of the document, so you only need to do this once
per session and cache `{ docId: K }` locally.

### Sharing a document with another identity

1. Ask the user (or the recipient) for the **identity ID** they want you to
   share with. Users can copy their ID from the web UI.
2. Fetch the recipient's X25519 public key:
   ```
   GET /api/identities/:recipientId
   ```
   Response has `encryptionPublicKey`.
3. Recover your copy of `K` (see above).
4. `createAccessGrant(K, myEncryptionPrivateKey, recipientEncryptionPublicKey)`
   → a new grant wrapping `K` for the recipient.
5. POST the grant:

```
POST /api/documents/:id/share
{
  "granteeIdentityId": "<recipient identity ID>",
  "encryptedSymmetricKey": "<wrapped for recipient>",
  "iv": "<iv>",
  "salt": "<salt>",
  "algorithm": "AES-GCM-256"
}
```

The recipient now sees the document in their list. The document content has
not been re-encrypted — only the key was wrapped for a new member.

### Listing documents

```
GET /api/documents
```

Each returned doc includes the encrypted title and the access grants for the
authenticated identity. Decrypt titles with their document keys to render.

### Search

There is no server-side search — the server cannot read plaintext. Agents
search client-side:

1. `GET /api/documents` to list all accessible docs.
2. For each doc, recover `K`, decrypt `encryptedTitle`.
3. For content-level matching, `GET /api/documents/:id/edits` and decrypt the
   latest `encryptedContent`.
4. Run the query over the decrypted titles and content in memory.

This is fine up to the low thousands of documents per identity. For
cross-document references, embed the target `docId` directly in the encrypted
content (e.g. `[[<docId>]]` as a client convention) — titles are mutable but
IDs are stable.

## Tickets

Tickets carry an encrypted title, an encrypted body, plus plaintext `status`
and `priority` (so the server can filter/sort without decrypting). Ticket
crypto uses the same access-grant mechanism as documents.

**Create:**

```
POST /api/tickets
{
  "encryptedTitle": "<ciphertext>",
  "encryptedTitleIv": "<iv>",
  "encryptedBody": "<ciphertext>",
  "encryptedBodyIv": "<iv>",
  "status": "open",
  "priority": "medium",
  "algorithm": "AES-GCM-256",
  "accessGrant": { ... self-grant, same shape as documents ... }
}
```

**Update metadata (status, priority, and/or re-encrypted title):**

```
PATCH /api/tickets/:id
{ "status": "in_progress", "priority": "high" }
```

**Replace encrypted content (title + body):**

```
PUT /api/tickets/:id
{
  "encryptedTitle": "<ciphertext>",
  "encryptedTitleIv": "<iv>",
  "encryptedBody": "<ciphertext>",
  "encryptedBodyIv": "<iv>",
  "algorithm": "AES-GCM-256"
}
```

**Add a signed, encrypted comment:**

```
POST /api/tickets/:id/comments
{
  "encryptedContent": "<ciphertext>",
  "encryptedContentIv": "<iv>",
  "signature": "<Ed25519 sig over plaintext>",
  "algorithm": "AES-GCM-256"
}
```

**Share / assign / list:**

```
POST /api/tickets/:id/share        # same grant shape as documents
PATCH /api/tickets/:id/assign      # { "assigneeIdentityId": "..." }
GET /api/tickets                   # list
GET /api/tickets/:id/comments      # list comments
```

## Webhooks

Subscribe to real-time events for one document or ticket.

```
POST /api/webhooks
{
  "url": "https://my-agent.example.com/hook",
  "resourceType": "document",
  "resourceId": "<doc or ticket ID>",
  "events": ["document.edited", "document.shared"]
}
```

The response includes a `secret` (HMAC-SHA256 signing key). It is returned
**only once** — store it immediately. Verify payloads by computing
`HMAC-SHA256(secret, raw_body)` and comparing to the `X-Webhook-Signature`
header. Reject if `X-Webhook-Timestamp` is older than 5 minutes.

```
GET /api/webhooks          # list the identity's subscriptions
DELETE /api/webhooks/:id   # unsubscribe
```

Webhooks auto-disable after 10 consecutive delivery failures.

## Identity lookup

```
GET /api/identities/:id
```

Returns `signingPublicKey`, `encryptionPublicKey`, `name`, `algorithmSuite`.
Needed before sharing (to wrap the doc key for the recipient's public key).

## Health

```
GET /health
```

No auth required. Returns `{ "ok": true }`.

## Error format

All errors return `{ "error": "<message>" }` with a 4xx/5xx status code.

## safescript tool

The `create-document.ss` file in this directory is a safescript implementation
of the full "create document + append first edit" flow. It reads the exported
identity bundle from secrets, generates the AES key, encrypts the title and
body, builds the self access grant, signs both requests, and returns the new
`documentId` plus the `documentKey` so the caller can store the key for
future edits. It is the current minimal example; a full per-operation bundle
(edit, share, rename, list, get, search) is planned. See
https://safescript.dev for the language.
