// Signed API client for agentdocs
// Signs every request with the active identity's Ed25519 key

import { signRequest } from "./crypto";
import type { StoredIdentity } from "./identity-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface ApiOptions {
  method?: string;
  body?: unknown;
  identity: StoredIdentity;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T = unknown>(
  path: string,
  { method = "GET", body, identity }: ApiOptions,
): Promise<T> {
  const timestamp = Date.now();
  const bodyStr = body ? JSON.stringify(body) : undefined;

  const signature = await signRequest(
    method,
    `/api${path}`,
    timestamp,
    bodyStr,
    identity.keyPair.signing.privateKey,
  );

  const headers: Record<string, string> = {
    "X-Identity-Id": identity.id,
    "X-Timestamp": String(timestamp),
    "X-Signature": signature,
  };
  if (bodyStr) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: bodyStr,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(res.status, err.error || `HTTP ${res.status}`);
  }

  return res.json();
}
