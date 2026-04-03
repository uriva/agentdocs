// @agentdocs/crypto - Core cryptographic operations for agentdocs E2EE
//
// Key types:
// - Ed25519: signing/verification (edit signatures, request auth)
// - X25519: key exchange (deriving shared secrets for access grants)
// - AES-256-GCM: symmetric encryption (document content)
//
// Note: Web Crypto API supports Ed25519 and X25519 natively in modern browsers.
// We use the "Ed25519" and "X25519" algorithm names directly.

// ─── Encoding Utilities ───────────────────────────────────────────────────────

/** Convert bytes to URL-safe base64 (no padding) */
export function base64urlEncode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode URL-safe base64 to bytes */
export function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Helper: get ArrayBuffer from base64url string (for Web Crypto compatibility) */
function decodeToBuffer(str: string): ArrayBuffer {
  return base64urlDecode(str).buffer as ArrayBuffer;
}

// ─── Algorithm Identifiers ────────────────────────────────────────────────────

export const ALGORITHMS = {
  signing: "Ed25519",
  keyExchange: "X25519",
  symmetric: "AES-GCM-256",
} as const;

export type AlgorithmSuite = typeof ALGORITHMS;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IdentityKeyPair {
  /** Ed25519 signing key pair */
  signing: {
    publicKey: string; // base64url-encoded raw public key
    privateKey: string; // base64url-encoded PKCS8 private key
  };
  /** X25519 key exchange key pair */
  encryption: {
    publicKey: string; // base64url-encoded raw public key
    privateKey: string; // base64url-encoded PKCS8 private key
  };
  algorithm: AlgorithmSuite;
}

export interface ExportedIdentity {
  signing: { privateKey: string };
  encryption: { privateKey: string };
  algorithm: AlgorithmSuite;
}

export interface EncryptedPayload {
  ciphertext: string; // base64url-encoded
  iv: string; // base64url-encoded (12 bytes for AES-GCM)
  algorithm: string;
}

export interface AccessGrant {
  encryptedSymmetricKey: string; // base64url-encoded
  iv: string; // base64url-encoded
  salt: string; // base64url-encoded (for HKDF)
  algorithm: AlgorithmSuite;
}

export interface SignedRequest {
  identityId: string;
  timestamp: number;
  signature: string; // base64url-encoded
  body?: string;
}

// ─── Key Generation ───────────────────────────────────────────────────────────

/** Generate a new identity key pair (Ed25519 signing + X25519 encryption) */
export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  const signingKeyPair = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  const encryptionKeyPair = (await crypto.subtle.generateKey("X25519", true, [
    "deriveKey",
    "deriveBits",
  ])) as CryptoKeyPair;

  const signingPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", signingKeyPair.publicKey)
  );
  const signingPrivatePkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", signingKeyPair.privateKey)
  );
  const encryptionPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", encryptionKeyPair.publicKey)
  );
  const encryptionPrivatePkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", encryptionKeyPair.privateKey)
  );

  return {
    signing: {
      publicKey: base64urlEncode(signingPublicRaw),
      privateKey: base64urlEncode(signingPrivatePkcs8),
    },
    encryption: {
      publicKey: base64urlEncode(encryptionPublicRaw),
      privateKey: base64urlEncode(encryptionPrivatePkcs8),
    },
    algorithm: ALGORITHMS,
  };
}

/** Generate a random AES-256-GCM symmetric key for document encryption */
export async function generateDocumentKey(): Promise<string> {
  const key = (await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  )) as CryptoKey;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return base64urlEncode(raw);
}

// ─── Symmetric Encryption (AES-256-GCM) ──────────────────────────────────────

/** Encrypt plaintext with an AES-256-GCM key */
export async function symmetricEncrypt(
  plaintext: string,
  keyBase64url: string
): Promise<EncryptedPayload> {
  const key = await crypto.subtle.importKey(
    "raw",
    decodeToBuffer(keyBase64url),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded.buffer as ArrayBuffer
    )
  );

  return {
    ciphertext: base64urlEncode(ciphertext),
    iv: base64urlEncode(iv),
    algorithm: ALGORITHMS.symmetric,
  };
}

/** Decrypt ciphertext with an AES-256-GCM key */
export async function symmetricDecrypt(
  payload: EncryptedPayload,
  keyBase64url: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    decodeToBuffer(keyBase64url),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const iv = base64urlDecode(payload.iv);
  const ciphertext = base64urlDecode(payload.ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  );

  return new TextDecoder().decode(plaintext);
}

// ─── Key Exchange (X25519 ECDH) ──────────────────────────────────────────────

/**
 * Derive a shared AES-256-GCM key from our X25519 private key and their
 * X25519 public key. Uses HKDF with a random salt for key derivation.
 */
async function deriveSharedKey(
  myPrivateKeyBase64url: string,
  theirPublicKeyBase64url: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const myPrivateKey = await crypto.subtle.importKey(
    "pkcs8",
    decodeToBuffer(myPrivateKeyBase64url),
    "X25519",
    false,
    ["deriveBits"]
  );

  const theirPublicKey = await crypto.subtle.importKey(
    "raw",
    decodeToBuffer(theirPublicKeyBase64url),
    "X25519",
    false,
    []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "X25519", public: theirPublicKey },
    myPrivateKey,
    256
  );

  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt.buffer as ArrayBuffer,
      info: new TextEncoder().encode("agentdocs-access-grant"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Create an access grant: encrypt a document's symmetric key so that
 * only the recipient can decrypt it.
 *
 * sender encrypts docKey with: ECDH(sender.encryptionPrivateKey, recipient.encryptionPublicKey)
 */
export async function createAccessGrant(
  docKeyBase64url: string,
  senderEncryptionPrivateKey: string,
  recipientEncryptionPublicKey: string
): Promise<AccessGrant> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const sharedKey = await deriveSharedKey(
    senderEncryptionPrivateKey,
    recipientEncryptionPublicKey,
    salt
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const docKeyBytes = base64urlDecode(docKeyBase64url);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      sharedKey,
      docKeyBytes.buffer as ArrayBuffer
    )
  );

  return {
    encryptedSymmetricKey: base64urlEncode(encrypted),
    iv: base64urlEncode(iv),
    salt: base64urlEncode(salt),
    algorithm: ALGORITHMS,
  };
}

/**
 * Decrypt an access grant to recover the document's symmetric key.
 *
 * recipient decrypts with: ECDH(recipient.encryptionPrivateKey, sender.encryptionPublicKey)
 */
export async function decryptAccessGrant(
  grant: AccessGrant,
  recipientEncryptionPrivateKey: string,
  senderEncryptionPublicKey: string
): Promise<string> {
  const salt = base64urlDecode(grant.salt);
  const sharedKey = await deriveSharedKey(
    recipientEncryptionPrivateKey,
    senderEncryptionPublicKey,
    salt
  );

  const iv = base64urlDecode(grant.iv);
  const encrypted = base64urlDecode(grant.encryptedSymmetricKey);
  const docKeyBytes = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      sharedKey,
      encrypted.buffer as ArrayBuffer
    )
  );

  return base64urlEncode(docKeyBytes);
}

// ─── Signing (Ed25519) ───────────────────────────────────────────────────────

/** Sign data with an Ed25519 private key */
export async function sign(
  data: Uint8Array,
  privateKeyBase64url: string
): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    decodeToBuffer(privateKeyBase64url),
    "Ed25519",
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign("Ed25519", privateKey, data.buffer as ArrayBuffer)
  );
  return base64urlEncode(signature);
}

/** Verify an Ed25519 signature */
export async function verify(
  data: Uint8Array,
  signatureBase64url: string,
  publicKeyBase64url: string
): Promise<boolean> {
  const publicKey = await crypto.subtle.importKey(
    "raw",
    decodeToBuffer(publicKeyBase64url),
    "Ed25519",
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    "Ed25519",
    publicKey,
    decodeToBuffer(signatureBase64url),
    data.buffer as ArrayBuffer
  );
}

// ─── Request Signing (for API auth) ──────────────────────────────────────────

/**
 * Sign an API request. Creates a signature over:
 * `${method}\n${path}\n${timestamp}\n${bodyHash}`
 *
 * The body hash is SHA-256 of the body (or empty string if no body).
 */
export async function signRequest(
  method: string,
  path: string,
  timestamp: number,
  body: string | undefined,
  signingPrivateKey: string
): Promise<string> {
  const bodyBytes = body ? new TextEncoder().encode(body) : new Uint8Array(0);
  const bodyHash = base64urlEncode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bodyBytes.buffer as ArrayBuffer)
    )
  );

  const message = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  return sign(new TextEncoder().encode(message), signingPrivateKey);
}

/**
 * Verify an API request signature.
 */
export async function verifyRequest(
  method: string,
  path: string,
  timestamp: number,
  body: string | undefined,
  signature: string,
  signingPublicKey: string
): Promise<boolean> {
  // Reject requests older than 5 minutes
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) return false;

  const bodyBytes = body ? new TextEncoder().encode(body) : new Uint8Array(0);
  const bodyHash = base64urlEncode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bodyBytes.buffer as ArrayBuffer)
    )
  );

  const message = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  return verify(new TextEncoder().encode(message), signature, signingPublicKey);
}

// ─── Key Export/Import ───────────────────────────────────────────────────────

/**
 * Export an identity's private keys for backup/transfer.
 * Returns a compact base64url string suitable for QR codes or URL fragments.
 */
export function exportIdentity(keyPair: IdentityKeyPair): string {
  const exported: ExportedIdentity = {
    signing: { privateKey: keyPair.signing.privateKey },
    encryption: { privateKey: keyPair.encryption.privateKey },
    algorithm: keyPair.algorithm,
  };
  return base64urlEncode(new TextEncoder().encode(JSON.stringify(exported)));
}

/**
 * Import an identity from an exported string.
 * Re-derives the public keys from the private keys.
 */
export async function importIdentity(
  exportedBase64url: string
): Promise<IdentityKeyPair> {
  const json = new TextDecoder().decode(base64urlDecode(exportedBase64url));
  const exported: ExportedIdentity = JSON.parse(json);

  // Re-derive signing public key via JWK round-trip
  const signingPrivateKey = await crypto.subtle.importKey(
    "pkcs8",
    decodeToBuffer(exported.signing.privateKey),
    "Ed25519",
    true,
    ["sign"]
  );
  const signingJwk = await crypto.subtle.exportKey("jwk", signingPrivateKey);
  const signingPublicJwk = { ...signingJwk, d: undefined, key_ops: ["verify"] };
  const signingPublicKey = await crypto.subtle.importKey(
    "jwk",
    signingPublicJwk,
    "Ed25519",
    true,
    ["verify"]
  );
  const signingPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", signingPublicKey)
  );

  // Re-derive encryption public key via JWK round-trip
  const encryptionPrivateKey = await crypto.subtle.importKey(
    "pkcs8",
    decodeToBuffer(exported.encryption.privateKey),
    "X25519",
    true,
    ["deriveBits"]
  );
  const encryptionJwk = await crypto.subtle.exportKey(
    "jwk",
    encryptionPrivateKey
  );
  const encryptionPublicJwk = {
    ...encryptionJwk,
    d: undefined,
    key_ops: [],
  };
  const encryptionPublicKey = await crypto.subtle.importKey(
    "jwk",
    encryptionPublicJwk,
    "X25519",
    true,
    []
  );
  const encryptionPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", encryptionPublicKey)
  );

  return {
    signing: {
      publicKey: base64urlEncode(signingPublicRaw),
      privateKey: exported.signing.privateKey,
    },
    encryption: {
      publicKey: base64urlEncode(encryptionPublicRaw),
      privateKey: exported.encryption.privateKey,
    },
    algorithm: exported.algorithm,
  };
}
