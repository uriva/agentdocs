# agentdocs

**[agentdocs.dev](https://agentdocs-nine.vercel.app/)** — End-to-end encrypted
documents, spreadsheets, and tickets — built for AI agents and humans.

All content is encrypted client-side. The server stores only ciphertext.

## Architecture

```
agentdocs/
├── api/           Deno + Hono API (Deno Deploy)
├── web/           Next.js frontend (Vercel)
└── llms.txt       LLM-consumable API reference
```

**Crypto stack:** Ed25519 signing, X25519 key agreement, AES-256-GCM encryption.

**Auth model:** Every API request is signed with the caller's Ed25519 private
key. No passwords, no sessions.

## Quick start

```bash
# API
cd api && deno task dev

# Web
cd web && npm install && npm run dev
```

## Regenerate docs

All API documentation is generated from `api/schema.ts`:

```bash
cd api && deno task generate-docs
```

This produces:

- `api/docs.html` — Standalone HTML docs
- `api/README-api.md` — Markdown API reference (below)
- `llms.txt` — LLM-consumable reference (served at `/llms.txt`)

---

<!-- BEGIN GENERATED API DOCS -->

## API Reference

Base URL: `https://agentdocs-api.uriva.deno.net`

### Authentication

All `/api/*` endpoints require signature-based authentication via three headers:

| Header | Description |
|--------|-------------|
| `X-Identity-Id` | Your identity ID |
| `X-Timestamp` | Current Unix timestamp in milliseconds |
| `X-Signature` | Base64url-encoded Ed25519 signature |

The signature covers: `METHOD\nPATH\nTIMESTAMP\nSHA256(BODY)`

### Public Endpoints

### `GET /health`

Returns `{ ok: true }` if the API is running. No authentication required.

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | true | **required** |  |

### `POST /register-identity`

Creates a new cryptographic identity linked to an InstantDB user account. The caller provides their Ed25519 signing key and X25519 encryption key. No signature auth is required (the user authenticates via InstantDB).

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signingPublicKey` | string | **required** | Base64-encoded Ed25519 signing public key |
| `encryptionPublicKey` | string | **required** | Base64-encoded X25519 encryption public key |
| `name` | string | optional | Human-readable display name |
| `algorithmSuite` | string | **required** | Algorithm suite identifier (e.g. Ed25519-X25519-AES256GCM) |
| `userId` | string | **required** | InstantDB user ID that owns this identity |

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `identity` | object | **required** |  |
| `identity.id` | string | **required** | Unique identity ID |

### Identities

### `GET /api/identities/:id` 🔒

Retrieve an identity's public keys and display name. Used when sharing a document or ticket with another user.

**Path parameters:**

- `id` — Identity ID

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `identity` | object | **required** |  |
| `identity.id` | string | **required** | Identity ID |
| `identity.signingPublicKey` | string | **required** | Base64-encoded Ed25519 signing public key |
| `identity.encryptionPublicKey` | string | **required** | Base64-encoded X25519 encryption public key |
| `identity.name` | string | **required** | Display name |
| `identity.algorithmSuite` | string | **required** | Algorithm suite identifier |

### Documents

### `GET /api/documents` 🔒

Returns all documents the authenticated identity has access to via access grants.

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `documents` | array | **required** | Documents the identity has access to |
| `[].id` | string | **required** |  |
| `[].type` | `doc` \| `spreadsheet` | **required** |  |
| `[].encryptedTitle` | string | **required** | Base64-encoded encrypted data |
| `[].encryptedTitleIv` | string | **required** | Base64-encoded initialization vector |
| `[].algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |
| `[].createdAt` | string | optional |  |

### `GET /api/documents/:id` 🔒

Returns a single document with the caller's access grants. 404 if the caller has no grant on this document.

**Path parameters:**

- `id` — Document ID

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document` | object | **required** |  |
| `document.id` | string | **required** |  |
| `document.type` | `doc` \| `spreadsheet` | **required** |  |
| `document.encryptedTitle` | string | **required** | Base64-encoded encrypted data |
| `document.encryptedTitleIv` | string | **required** | Base64-encoded initialization vector |
| `document.algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |
| `document.createdAt` | string | optional |  |
| `document.accessGrants` | array | **required** | Access grants the caller can use to derive the document key |

### `POST /api/documents` 🔒

Creates a new encrypted document (type: doc or spreadsheet). The encrypted title and an access grant for the creator must be provided.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `doc` \| `spreadsheet` | **required** | Document type |
| `encryptedTitle` | string | **required** | Encrypted document title |
| `encryptedTitleIv` | string | **required** | IV for the encrypted title |
| `algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |
| `accessGrant` | object | **required** | Access grant for the creator |
| `accessGrant.encryptedSymmetricKey` | string | **required** | Document symmetric key, encrypted for the grantee |
| `accessGrant.iv` | string | **required** | IV used when encrypting the symmetric key |
| `accessGrant.salt` | string | **required** | Salt used in key derivation |
| `accessGrant.algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |

**Response** (`201`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document` | object | **required** |  |
| `document.id` | string | **required** | Newly created document ID |

### `GET /api/documents/:id/edits` 🔒

Returns the full edit history for a document, ordered by sequence number.

**Path parameters:**

- `id` — Document ID

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `edits` | array | **required** | Ordered list of document edits |
| `[].id` | string | **required** |  |
| `[].encryptedContent` | string | **required** | Base64-encoded encrypted data |
| `[].encryptedContentIv` | string | **required** | Base64-encoded initialization vector |
| `[].signature` | string | **required** | Base64-encoded Ed25519 signature |
| `[].sequenceNumber` | number | **required** |  |
| `[].algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |
| `[].editType` | `content` \| `title` | optional | Type of edit: 'content' for body changes, 'title' for renames |
| `[].authorIdentityId` | string | **required** |  |
| `[].createdAt` | string | optional |  |

### `POST /api/documents/:id/edits` 🔒

Appends a new edit (encrypted content snapshot) to a document's history. Each edit includes an Ed25519 signature over the plaintext for tamper detection.

**Path parameters:**

- `id` — Document ID

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `encryptedContent` | string | **required** | Encrypted edit content (full document snapshot or delta) |
| `encryptedContentIv` | string | **required** | IV for the encrypted content |
| `signature` | string | **required** | Author's Ed25519 signature over the plaintext content |
| `sequenceNumber` | number | **required** | Monotonically increasing edit sequence number |
| `algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |
| `editType` | `content` \| `title` | optional | Type of edit: 'content' for body changes, 'title' for renames (default: `"content"`) |

**Response** (`201`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `edit` | object | **required** |  |
| `edit.id` | string | **required** | Newly created edit ID |

### `POST /api/documents/:id/share` 🔒

Grants another identity access to this document by providing them with the document's symmetric key encrypted to their public key.

**Path parameters:**

- `id` — Document ID

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `granteeIdentityId` | string | **required** | Identity ID of the recipient |
| `encryptedSymmetricKey` | string | **required** | Document symmetric key, encrypted for the grantee |
| `iv` | string | **required** | IV used when encrypting the symmetric key |
| `salt` | string | **required** | Salt used in key derivation |
| `algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |

**Response** (`201`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accessGrant` | object | **required** |  |
| `accessGrant.id` | string | **required** | Access grant ID |

### `PATCH /api/documents/:id` 🔒

Updates the encrypted title of an existing document. The caller must have access to the document via an access grant.

**Path parameters:**

- `id` — Document ID

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `encryptedTitle` | string | **required** | Encrypted new document title |
| `encryptedTitleIv` | string | **required** | IV for the encrypted title |
| `algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | true | **required** |  |

### Tickets

### `GET /api/tickets` 🔒

Returns all tickets the authenticated identity has access to.

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tickets` | array | **required** | Tickets the identity has access to |
| `[].id` | string | **required** |  |
| `[].encryptedTitle` | string | **required** | Base64-encoded encrypted data |
| `[].encryptedTitleIv` | string | **required** | Base64-encoded initialization vector |
| `[].encryptedBody` | string | **required** | Base64-encoded encrypted data |
| `[].encryptedBodyIv` | string | **required** | Base64-encoded initialization vector |
| `[].status` | `open` \| `in_progress` \| `closed` | **required** | Ticket status |
| `[].priority` | `low` \| `medium` \| `high` \| `urgent` | **required** | Ticket priority |
| `[].algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |
| `[].createdAt` | string | optional |  |

### `POST /api/tickets` 🔒

Creates a new encrypted ticket with title, body, optional status/priority, and an access grant for the creator.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `encryptedTitle` | string | **required** | Encrypted ticket title |
| `encryptedTitleIv` | string | **required** | IV for the encrypted title |
| `encryptedBody` | string | **required** | Encrypted ticket body (markdown) |
| `encryptedBodyIv` | string | **required** | IV for the encrypted body |
| `status` | `open` \| `in_progress` \| `closed` | optional | Ticket status (default: `"open"`) |
| `priority` | `low` \| `medium` \| `high` \| `urgent` | optional | Ticket priority (default: `"medium"`) |
| `algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |
| `accessGrant` | object | **required** | Access grant for the creator |
| `accessGrant.encryptedSymmetricKey` | string | **required** | Document symmetric key, encrypted for the grantee |
| `accessGrant.iv` | string | **required** | IV used when encrypting the symmetric key |
| `accessGrant.salt` | string | **required** | Salt used in key derivation |
| `accessGrant.algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |

**Response** (`201`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticket` | object | **required** |  |
| `ticket.id` | string | **required** | Newly created ticket ID |

### `PATCH /api/tickets/:id` 🔒

Updates a ticket's status and/or priority. These are plaintext fields so no re-encryption is needed.

**Path parameters:**

- `id` — Ticket ID

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `open` \| `in_progress` \| `closed` | optional | Ticket status |
| `priority` | `low` \| `medium` \| `high` \| `urgent` | optional | Ticket priority |
| `encryptedTitle` | string | optional | Re-encrypted ticket title |
| `encryptedTitleIv` | string | optional | New IV for the encrypted title |
| `algorithm` | string | optional | Encryption algorithm identifier (e.g. AES-GCM-256) |

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | true | **required** |  |

### `PUT /api/tickets/:id` 🔒

Replaces the ticket's encrypted title and body with new ciphertext.

**Path parameters:**

- `id` — Ticket ID

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `encryptedTitle` | string | **required** | Re-encrypted ticket title |
| `encryptedTitleIv` | string | **required** | New IV for the encrypted title |
| `encryptedBody` | string | **required** | Re-encrypted ticket body |
| `encryptedBodyIv` | string | **required** | New IV for the encrypted body |
| `algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | true | **required** |  |

### `GET /api/tickets/:id/comments` 🔒

Returns all comments for a ticket, ordered by creation time.

**Path parameters:**

- `id` — Ticket ID

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comments` | array | **required** | Ordered list of ticket comments |
| `[].id` | string | **required** |  |
| `[].encryptedContent` | string | **required** | Base64-encoded encrypted data |
| `[].encryptedContentIv` | string | **required** | Base64-encoded initialization vector |
| `[].signature` | string | **required** | Base64-encoded Ed25519 signature |
| `[].algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |
| `[].authorIdentityId` | string | **required** |  |
| `[].createdAt` | string | optional |  |

### `POST /api/tickets/:id/comments` 🔒

Adds an encrypted comment to a ticket. Includes an Ed25519 signature for authenticity.

**Path parameters:**

- `id` — Ticket ID

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `encryptedContent` | string | **required** | Encrypted comment content |
| `encryptedContentIv` | string | **required** | IV for the encrypted content |
| `signature` | string | **required** | Author's Ed25519 signature over the plaintext content |
| `algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |

**Response** (`201`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comment` | object | **required** |  |
| `comment.id` | string | **required** | Newly created comment ID |

### `POST /api/tickets/:id/share` 🔒

Grants another identity access to this ticket by providing them with the ticket's symmetric key encrypted to their public key.

**Path parameters:**

- `id` — Ticket ID

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `granteeIdentityId` | string | **required** | Identity ID of the recipient |
| `encryptedSymmetricKey` | string | **required** | Document symmetric key, encrypted for the grantee |
| `iv` | string | **required** | IV used when encrypting the symmetric key |
| `salt` | string | **required** | Salt used in key derivation |
| `algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |

**Response** (`201`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accessGrant` | object | **required** |  |
| `accessGrant.id` | string | **required** | Access grant ID |

### `PATCH /api/tickets/:id/assign` 🔒

Assigns a ticket to another identity.

**Path parameters:**

- `id` — Ticket ID

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assigneeIdentityId` | string | **required** | Identity ID to assign the ticket to |

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | true | **required** |  |

### Webhooks

Subscribe to real-time events on documents and tickets. Webhook payloads are signed with HMAC-SHA256 — verify using the `X-Webhook-Signature` header.

### `GET /api/webhooks` 🔒

Returns all webhook subscriptions owned by the authenticated identity.

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `webhooks` | array | **required** | Webhook subscriptions for the authenticated identity |
| `[].id` | string | **required** |  |
| `[].url` | string | **required** |  |
| `[].resourceType` | `document` \| `ticket` | **required** | Resource type |
| `[].resourceId` | string | **required** |  |
| `[].events` | array | **required** |  |
| `[].active` | boolean | **required** | Whether the webhook is active (disabled after repeated failures) |
| `[].createdAt` | string | optional |  |

### `POST /api/webhooks` 🔒

Subscribe to real-time events for a specific document or ticket. When a matching event occurs, agentdocs sends an HMAC-signed POST to your URL with event metadata (never encrypted content). The HMAC-SHA256 signing secret is returned only once on creation — store it securely. Verify payloads by comparing X-Webhook-Signature to HMAC-SHA256(secret, raw_body).

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | **required** | HTTPS URL to receive webhook POST requests |
| `resourceType` | `document` \| `ticket` | **required** | Resource type |
| `resourceId` | string | **required** | ID of the document or ticket to watch |
| `events` | array | **required** | Event types to subscribe to |

**Response** (`201`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `webhook` | object | **required** |  |
| `webhook.id` | string | **required** | Webhook subscription ID |
| `webhook.secret` | string | **required** | HMAC-SHA256 signing secret. Store this securely — it is only returned once. Verify incoming payloads by computing HMAC-SHA256(secret, raw_body) and comparing to the X-Webhook-Signature header. |

### `DELETE /api/webhooks/:id` 🔒

Permanently removes a webhook subscription. Deliveries in flight may still complete.

**Path parameters:**

- `id` — Webhook subscription ID

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ok` | true | **required** |  |

