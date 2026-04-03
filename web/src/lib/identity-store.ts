// Identity store — manages identities in localStorage
// Each identity has: id (from InstantDB), name, key pair
// The active identity is the one currently in use

import type { IdentityKeyPair } from "./crypto";

const STORAGE_KEY = "agentdocs:identities";
const ACTIVE_KEY = "agentdocs:active-identity";

export interface StoredIdentity {
  /** InstantDB entity ID (set after registration) */
  id: string;
  /** Human-readable label */
  name: string;
  /** Full key pair (private keys live only in localStorage, never server) */
  keyPair: IdentityKeyPair;
  /** ISO timestamp */
  createdAt: string;
}

function readAll(): StoredIdentity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(identities: StoredIdentity[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identities));
}

/** Get all stored identities */
export function getIdentities(): StoredIdentity[] {
  return readAll();
}

/** Get the active identity (or null if none) */
export function getActiveIdentity(): StoredIdentity | null {
  if (typeof window === "undefined") return null;
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (!activeId) {
    // Fall back to first identity
    const all = readAll();
    if (all.length > 0) {
      setActiveIdentity(all[0].id);
      return all[0];
    }
    return null;
  }
  return readAll().find((i) => i.id === activeId) ?? null;
}

/** Set the active identity by ID */
export function setActiveIdentity(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

/** Store a new identity */
export function addIdentity(identity: StoredIdentity) {
  const all = readAll();
  all.push(identity);
  writeAll(all);
  // If this is the first identity, make it active
  if (all.length === 1) {
    setActiveIdentity(identity.id);
  }
}

/** Remove an identity by ID */
export function removeIdentity(id: string) {
  const all = readAll().filter((i) => i.id !== id);
  writeAll(all);
  // If we removed the active identity, switch to first remaining
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (activeId === id) {
    if (all.length > 0) {
      setActiveIdentity(all[0].id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }
}

/** Update an identity's name */
export function renameIdentity(id: string, name: string) {
  const all = readAll();
  const identity = all.find((i) => i.id === id);
  if (identity) {
    identity.name = name;
    writeAll(all);
  }
}

/** Get short fingerprint from a public key (first 8 chars of base64url) */
export function fingerprint(publicKey: string): string {
  return publicKey.slice(0, 8);
}
