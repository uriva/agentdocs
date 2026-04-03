// Crypto functions for the web app — mirrors @agentdocs/crypto
// Uses Web Crypto API (native in modern browsers)

// ─── Encoding ────────────────────────────────────────────────────────────────

export function base64urlEncode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeToBuffer(str: string): ArrayBuffer {
  return base64urlDecode(str).buffer as ArrayBuffer;
}

// ─── Algorithm Identifiers ───────────────────────────────────────────────────

export const ALGORITHMS = {
  signing: "Ed25519",
  keyExchange: "X25519",
  symmetric: "AES-GCM-256",
} as const;

export type AlgorithmSuite = typeof ALGORITHMS;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IdentityKeyPair {
  signing: {
    publicKey: string; // base64url raw
    privateKey: string; // base64url PKCS8
  };
  encryption: {
    publicKey: string; // base64url raw
    privateKey: string; // base64url PKCS8
  };
  algorithm: AlgorithmSuite;
}

export interface ExportedIdentity {
  /** Identity ID from server (for matching on import) */
  id: string;
  /** Human-readable name */
  name: string;
  signing: { privateKey: string };
  encryption: { privateKey: string };
  algorithm: AlgorithmSuite;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  algorithm: string;
}

export interface AccessGrant {
  encryptedSymmetricKey: string;
  iv: string;
  salt: string;
  algorithm: AlgorithmSuite;
}

export interface SignedRequest {
  identityId: string;
  timestamp: number;
  signature: string;
  body?: string;
}

// ─── Key Generation ──────────────────────────────────────────────────────────

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

export async function generateDocumentKey(): Promise<string> {
  const key = (await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  )) as CryptoKey;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return base64urlEncode(raw);
}

// ─── Symmetric Encryption (AES-256-GCM) ─────────────────────────────────────

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

// ─── Key Exchange (X25519 ECDH) ─────────────────────────────────────────────

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

// ─── Signing (Ed25519) ──────────────────────────────────────────────────────

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

// ─── Request Signing ─────────────────────────────────────────────────────────

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

// ─── Key Export/Import ───────────────────────────────────────────────────────

export function exportIdentity(
  id: string,
  name: string,
  keyPair: IdentityKeyPair,
): string {
  const exported: ExportedIdentity = {
    id,
    name,
    signing: { privateKey: keyPair.signing.privateKey },
    encryption: { privateKey: keyPair.encryption.privateKey },
    algorithm: keyPair.algorithm,
  };
  return base64urlEncode(new TextEncoder().encode(JSON.stringify(exported)));
}

export async function importIdentity(
  exportedBase64url: string
): Promise<{ id: string; name: string; keyPair: IdentityKeyPair }> {
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
    id: exported.id,
    name: exported.name,
    keyPair: {
      signing: {
        publicKey: base64urlEncode(signingPublicRaw),
        privateKey: exported.signing.privateKey,
      },
      encryption: {
        publicKey: base64urlEncode(encryptionPublicRaw),
        privateKey: exported.encryption.privateKey,
      },
      algorithm: exported.algorithm,
    },
  };
}
