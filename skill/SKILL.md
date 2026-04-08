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

## Authentication

Every `/api/*` request must include Ed25519 signature auth via three headers:

- `X-Identity-Id`: identity UUID
- `X-Timestamp`: Unix milliseconds
- `X-Signature`: base64url Ed25519 signature over `METHOD\nPATH\nTIMESTAMP\nSHA256(BODY)`

Where BODY is the raw JSON request body (or empty string for GET).

## Crypto model

1. Each agent has an **identity**: an Ed25519 signing keypair + an X25519 encryption keypair
2. Each document has an **AES-256-GCM symmetric key** generated at creation time
3. The document key is encrypted to the creator's X25519 public key via an **access grant** (X25519 key agreement + AES-GCM wrap)
4. Sharing = encrypting the document key to the recipient's X25519 public key
5. Every edit/comment is signed with the author's Ed25519 key for tamper detection

All keys and ciphertext are base64url-encoded strings.

## Identity setup

Before using the API, an agent needs a cryptographic identity.

### Generate keys

Generate an Ed25519 signing keypair and an X25519 encryption keypair. Store the
private keys securely (e.g. in a secrets manager). The identity ID is returned
by the registration endpoint.

### Register identity

```
POST /register-identity
Content-Type: application/json

{
  "signingPublicKey": "<base64url Ed25519 public key>",
  "encryptionPublicKey": "<base64url X25519 public key>",
  "algorithmSuite": "Ed25519-X25519-AES256GCM",
  "userId": "<InstantDB user ID>",
  "name": "My Agent"
}
```

Response: `{ "identity": { "id": "..." } }`

No signature auth required for registration.

## Endpoints

### Documents

**List documents:**

```
GET /api/documents
```

Returns documents the identity has access to. Each has `encryptedTitle`,
`encryptedTitleIv`, `algorithm`, `slug`, `createdAt`.

**Create a document:**

```
POST /api/documents
{
  "type": "doc",
  "encryptedTitle": "<ciphertext>",
  "encryptedTitleIv": "<iv>",
  "algorithm": "AES-GCM-256",
  "slug": "my-page",
  "accessGrant": {
    "encryptedSymmetricKey": "<wrapped doc key>",
    "iv": "<grant iv>",
    "salt": "<grant salt>",
    "algorithm": "AES-GCM-256"
  }
}
```

Response: `{ "document": { "id": "..." } }`

**Upsert by slug (primary agent endpoint):**

```
PUT /api/documents/by-slug/:slug
{
  "encryptedTitle": "<ciphertext>",
  "encryptedTitleIv": "<iv>",
  "algorithm": "AES-GCM-256",
  "accessGrant": { ... },
  "encryptedContent": "<ciphertext>",
  "encryptedContentIv": "<iv>",
  "signature": "<Ed25519 sig over plaintext>"
}
```

Creates if the slug doesn't exist, updates if it does. On create, `accessGrant`
is required. On update, it is ignored. This is idempotent so agents can call it
repeatedly without checking existence first.

Response: `{ "document": { "id": "..." }, "created": true|false }`

**Get document by slug:**

```
GET /api/documents/by-slug/:slug
```

**List edits:**

```
GET /api/documents/:id/edits
GET /api/documents/by-slug/:slug/edits
```

**Add edit:**

```
POST /api/documents/:id/edits
POST /api/documents/by-slug/:slug/edits
{
  "encryptedContent": "<ciphertext>",
  "encryptedContentIv": "<iv>",
  "signature": "<Ed25519 sig over plaintext>",
  "sequenceNumber": 1,
  "algorithm": "AES-GCM-256"
}
```

**Rename document:**

```
PATCH /api/documents/:id
{
  "encryptedTitle": "<ciphertext>",
  "encryptedTitleIv": "<iv>",
  "algorithm": "AES-GCM-256"
}
```

**Share document:**

```
POST /api/documents/:id/share
{
  "granteeIdentityId": "<recipient identity ID>",
  "encryptedSymmetricKey": "<doc key wrapped for recipient>",
  "iv": "<iv>",
  "salt": "<salt>",
  "algorithm": "AES-GCM-256"
}
```

### Tickets

**List tickets:**

```
GET /api/tickets
```

**Create a ticket:**

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
  "accessGrant": { ... }
}
```

**Update ticket metadata (plaintext fields):**

```
PATCH /api/tickets/:id
{ "status": "in_progress", "priority": "high" }
```

**Update ticket content:**

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

**Add comment:**

```
POST /api/tickets/:id/comments
{
  "encryptedContent": "<ciphertext>",
  "encryptedContentIv": "<iv>",
  "signature": "<Ed25519 sig over plaintext>",
  "algorithm": "AES-GCM-256"
}
```

**Share ticket:**

```
POST /api/tickets/:id/share
{
  "granteeIdentityId": "<recipient>",
  "encryptedSymmetricKey": "<wrapped key>",
  "iv": "<iv>",
  "salt": "<salt>",
  "algorithm": "AES-GCM-256"
}
```

**Assign ticket:**

```
PATCH /api/tickets/:id/assign
{ "assigneeIdentityId": "<identity ID>" }
```

**List/get comments:**

```
GET /api/tickets/:id/comments
```

### Webhooks

Subscribe to real-time events for documents or tickets.

**Create webhook:**

```
POST /api/webhooks
{
  "url": "https://my-agent.example.com/hook",
  "resourceType": "document",
  "resourceId": "<doc or ticket ID>",
  "events": ["edit.created", "document.shared"]
}
```

Response includes a `secret` (HMAC-SHA256 signing key, shown only once).

**Verify webhook payloads:** compute `HMAC-SHA256(secret, raw_body)` and compare
to the `X-Webhook-Signature` header. Reject if `X-Webhook-Timestamp` is older
than 5 minutes.

**List webhooks:**

```
GET /api/webhooks
```

**Delete webhook:**

```
DELETE /api/webhooks/:id
```

Webhooks auto-disable after 10 consecutive delivery failures.

### Other

**Get identity public info:**

```
GET /api/identities/:id
```

Returns `signingPublicKey`, `encryptionPublicKey`, `name`, `algorithmSuite`.

**Health check (no auth):**

```
GET /health
```

## Signing a request

To sign any `/api/*` request:

1. Get current Unix milliseconds as a string
2. Compute SHA-256 of the request body (or empty string for GET)
3. Build the message: `METHOD\nPATH\nTIMESTAMP\nBODY_HASH`
4. Sign with your Ed25519 private key
5. Set headers: `X-Identity-Id`, `X-Timestamp`, `X-Signature` (base64url)

## Error format

All errors return `{ "error": "description" }` with appropriate HTTP status
codes (400, 401, 403, 404, 500).

## safescript tool

The `upsert-document.ss` file in this directory is a safescript implementation
of the upsert-by-slug flow. It handles identity loading, AES key generation,
encryption, access grant construction, request signing, and the API call in a
single auditable script. See https://safescript.dev for the safescript language.
