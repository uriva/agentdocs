"use client";

// React hook for identity management
// Wraps the localStorage identity store with React state

import { useState, useEffect, useCallback } from "react";
import {
  type StoredIdentity,
  getIdentities,
  getActiveIdentity,
  setActiveIdentity as storeSetActive,
  addIdentity,
  removeIdentity,
  renameIdentity,
} from "@/lib/identity-store";
import {
  generateIdentityKeyPair,
  ALGORITHMS,
  type IdentityKeyPair,
} from "@/lib/crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface UseIdentityReturn {
  /** All stored identities */
  identities: StoredIdentity[];
  /** Currently active identity (or null) */
  active: StoredIdentity | null;
  /** Whether we're still loading from localStorage */
  loading: boolean;
  /** Switch the active identity */
  switchTo: (id: string) => void;
  /** Create a new identity (generates keys, registers with API) */
  create: (name: string, userId: string) => Promise<StoredIdentity>;
  /** Import an existing identity (already registered server-side) */
  importExisting: (data: {
    id: string;
    name: string;
    keyPair: IdentityKeyPair;
  }) => StoredIdentity;
  /** Remove an identity */
  remove: (id: string) => void;
  /** Rename an identity */
  rename: (id: string, name: string) => void;
}

export function useIdentity(): UseIdentityReturn {
  const [identities, setIdentities] = useState<StoredIdentity[]>([]);
  const [active, setActive] = useState<StoredIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    setIdentities(getIdentities());
    setActive(getActiveIdentity());
    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    setIdentities(getIdentities());
    setActive(getActiveIdentity());
  }, []);

  const switchTo = useCallback(
    (id: string) => {
      storeSetActive(id);
      refresh();
    },
    [refresh]
  );

  const create = useCallback(
    async (name: string, userId: string): Promise<StoredIdentity> => {
      // 1. Generate key pair client-side
      const keyPair = await generateIdentityKeyPair();

      // 2. Register public keys with the API
      const res = await fetch(`${API_URL}/register-identity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signingPublicKey: keyPair.signing.publicKey,
          encryptionPublicKey: keyPair.encryption.publicKey,
          name,
          algorithmSuite: JSON.stringify(ALGORITHMS),
          userId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to register identity");
      }

      const { identity } = await res.json();

      // 3. Store locally (private keys never leave the browser)
      const stored: StoredIdentity = {
        id: identity.id,
        name,
        keyPair,
        createdAt: new Date().toISOString(),
      };
      addIdentity(stored);
      refresh();
      return stored;
    },
    [refresh]
  );

  const remove = useCallback(
    (id: string) => {
      removeIdentity(id);
      refresh();
    },
    [refresh]
  );

  const rename = useCallback(
    (id: string, name: string) => {
      renameIdentity(id, name);
      refresh();
    },
    [refresh]
  );

  const importExisting = useCallback(
    (data: { id: string; name: string; keyPair: IdentityKeyPair }) => {
      // Remove existing identity with same ID if present (replace)
      const existing = getIdentities().find((i) => i.id === data.id);
      if (existing) {
        removeIdentity(data.id);
      }

      const stored: StoredIdentity = {
        id: data.id,
        name: data.name,
        keyPair: data.keyPair,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      addIdentity(stored);
      storeSetActive(stored.id);
      refresh();
      return stored;
    },
    [refresh]
  );

  return {
    identities,
    active,
    loading,
    switchTo,
    create,
    importExisting,
    remove,
    rename,
  };
}
