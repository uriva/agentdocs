// Re-export crypto functions for the Deno API.
// In production, this would import from the shared @agentdocs/crypto package.
// For now, we inline the needed functions since Deno can't directly import
// from the npm-style packages/crypto without a build step.

export function base64urlEncode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/,
    "",
  );
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

export async function sign(
  data: Uint8Array,
  privateKeyBase64url: string,
): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    decodeToBuffer(privateKeyBase64url),
    "Ed25519",
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("Ed25519", privateKey, data.buffer as ArrayBuffer),
  );
  return base64urlEncode(signature);
}

export async function verify(
  data: Uint8Array,
  signatureBase64url: string,
  publicKeyBase64url: string,
): Promise<boolean> {
  const publicKey = await crypto.subtle.importKey(
    "raw",
    decodeToBuffer(publicKeyBase64url),
    "Ed25519",
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "Ed25519",
    publicKey,
    decodeToBuffer(signatureBase64url),
    data.buffer as ArrayBuffer,
  );
}

export async function verifyRequest(
  method: string,
  path: string,
  timestamp: number,
  body: string | undefined,
  signature: string,
  signingPublicKey: string,
): Promise<boolean> {
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) return false;

  const bodyBytes = body ? new TextEncoder().encode(body) : new Uint8Array(0);
  const bodyHash = base64urlEncode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bodyBytes.buffer as ArrayBuffer),
    ),
  );

  const message = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  return verify(new TextEncoder().encode(message), signature, signingPublicKey);
}
