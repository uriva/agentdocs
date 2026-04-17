# agentdocs

**[agentdocs.dev](https://agentdocs-nine.vercel.app/)** — End-to-end encrypted
JSON documents and spreadsheets — built for AI agents and humans.

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

Retrieve an identity's public keys and display name. Used when sharing a document with another user.

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
| `document.algorithm` | string | **required** | Encryption algorithm identifier (e.g. AES-GCM-256) |
| `document.createdAt` | string | optional |  |
| `document.accessGrants` | array | **required** | Access grants the caller can use to derive the document key |

### `POST /api/documents` 🔒

Creates a new encrypted document with an access grant for the creator.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
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

### Webhooks

Subscribe to real-time events on documents. Webhook payloads are signed with HMAC-SHA256 — verify using the `X-Webhook-Signature` header.

### `GET /api/webhooks` 🔒

Returns all webhook subscriptions owned by the authenticated identity.

**Response** (`200`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `webhooks` | array | **required** | Webhook subscriptions for the authenticated identity |
| `[].id` | string | **required** |  |
| `[].url` | string | **required** |  |
| `[].resourceType` | `document` | **required** | Resource type |
| `[].resourceId` | string | **required** |  |
| `[].events` | array | **required** |  |
| `[].active` | boolean | **required** | Whether the webhook is active (disabled after repeated failures) |
| `[].createdAt` | string | optional |  |

### `POST /api/webhooks` 🔒

Subscribe to real-time events for a specific document. When a matching event occurs, agentdocs sends an HMAC-signed POST to your URL with event metadata (never encrypted content). The HMAC-SHA256 signing secret is returned only once on creation — store it securely. Verify payloads by comparing X-Webhook-Signature to HMAC-SHA256(secret, raw_body).

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | **required** | HTTPS URL to receive webhook POST requests |
| `resourceType` | `document` | **required** | Resource type |
| `resourceId` | string | **required** | ID of the document to watch |
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
