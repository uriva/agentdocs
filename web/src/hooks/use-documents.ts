"use client";

// React hook for document operations
// Handles encryption/decryption client-side, talks to API for persistence

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  generateDocumentKey,
  symmetricEncrypt,
  symmetricDecrypt,
  createAccessGrant as cryptoCreateAccessGrant,
  decryptAccessGrant,
  sign,
  ALGORITHMS,
  type EncryptedPayload,
  type AccessGrant,
} from "@/lib/crypto";
import type { StoredIdentity } from "@/lib/identity-store";

export interface DocumentHeader {
  id: string;
  type: string;
  title: string;
  createdAt: number;
  /** Decrypted document symmetric key (in memory only) */
  docKey: string;
}

interface RawDocument {
  id: string;
  type: string;
  encryptedTitle: string;
  encryptedTitleIv: string;
  algorithm: string;
  createdAt: number;
  accessGrants: Array<{
    id: string;
    encryptedSymmetricKey: string;
    iv: string;
    salt: string;
    algorithm: string;
    grantor: Array<{ id: string; encryptionPublicKey: string }>;
  }>;
}

export interface DocumentEdit {
  id: string;
  content: string;
  sequenceNumber: number;
  createdAt: number;
  authorId: string;
}

interface RawEdit {
  id: string;
  encryptedContent: string;
  encryptedContentIv: string;
  algorithm: string;
  signature: string;
  sequenceNumber: number;
  createdAt: number;
  author: Array<{ id: string }>;
}

// ─── useDocuments: list documents for the active identity ────────────────────

export function useDocuments(identity: StoredIdentity | null) {
  const [documents, setDocuments] = useState<DocumentHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!identity) {
      setDocuments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ documents: RawDocument[] }>("/documents", {
        identity,
      });

      const decrypted: DocumentHeader[] = [];
      for (const doc of res.documents) {
        // Find the access grant for this identity
        const grant = doc.accessGrants?.find((g) =>
          // We need to decrypt the doc key using the grantor's public key
          g.grantor?.length > 0,
        );
        if (!grant || !grant.grantor?.[0]) continue;

        try {
          const docKey = await decryptAccessGrant(
            {
              encryptedSymmetricKey: grant.encryptedSymmetricKey,
              iv: grant.iv,
              salt: grant.salt,
              algorithm: ALGORITHMS,
            },
            identity.keyPair.encryption.privateKey,
            grant.grantor[0].encryptionPublicKey,
          );

          const title = await symmetricDecrypt(
            {
              ciphertext: doc.encryptedTitle,
              iv: doc.encryptedTitleIv,
              algorithm: doc.algorithm,
            },
            docKey,
          );

          decrypted.push({
            id: doc.id,
            type: doc.type,
            title,
            createdAt: doc.createdAt,
            docKey,
          });
        } catch {
          // Can't decrypt — wrong key or corrupt grant, skip
          continue;
        }
      }

      decrypted.sort((a, b) => b.createdAt - a.createdAt);
      setDocuments(decrypted);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load documents",
      );
    } finally {
      setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createDocument = useCallback(
    async (title: string, type: "doc" | "spreadsheet" = "doc") => {
      if (!identity) throw new Error("No active identity");

      // 1. Generate doc symmetric key
      const docKey = await generateDocumentKey();

      // 2. Encrypt the title
      const encTitle = await symmetricEncrypt(title, docKey);

      // 3. Create access grant for ourselves (self-grant)
      const grant = await cryptoCreateAccessGrant(
        docKey,
        identity.keyPair.encryption.privateKey,
        identity.keyPair.encryption.publicKey,
      );

      // 4. Send to API
      const res = await api<{ document: { id: string } }>("/documents", {
        method: "POST",
        identity,
        body: {
          type,
          encryptedTitle: encTitle.ciphertext,
          encryptedTitleIv: encTitle.iv,
          algorithm: encTitle.algorithm,
          accessGrant: {
            encryptedSymmetricKey: grant.encryptedSymmetricKey,
            iv: grant.iv,
            salt: grant.salt,
            algorithm: JSON.stringify(grant.algorithm),
          },
        },
      });

      await refresh();
      return res.document.id;
    },
    [identity, refresh],
  );

  return { documents, loading, error, refresh, createDocument };
}

// ─── renameDocument: standalone helper (no hook state needed) ────────────────

export async function renameDocument(
  documentId: string,
  newTitle: string,
  docKey: string,
  identity: StoredIdentity,
): Promise<void> {
  const encTitle = await symmetricEncrypt(newTitle, docKey);
  await api(`/documents/${documentId}`, {
    method: "PATCH",
    identity,
    body: {
      encryptedTitle: encTitle.ciphertext,
      encryptedTitleIv: encTitle.iv,
      algorithm: encTitle.algorithm,
    },
  });
}

// ─── useDocumentEdits: load/add edits for a specific document ────────────────

export function useDocumentEdits(
  documentId: string | null,
  docKey: string | null,
  identity: StoredIdentity | null,
) {
  const [edits, setEdits] = useState<DocumentEdit[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!documentId || !docKey || !identity) {
      setEdits([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ edits: RawEdit[] }>(
        `/documents/${documentId}/edits`,
        { identity },
      );

      const decrypted: DocumentEdit[] = [];
      for (const edit of res.edits) {
        try {
          const content = await symmetricDecrypt(
            {
              ciphertext: edit.encryptedContent,
              iv: edit.encryptedContentIv,
              algorithm: edit.algorithm,
            },
            docKey,
          );
          decrypted.push({
            id: edit.id,
            content,
            sequenceNumber: edit.sequenceNumber,
            createdAt: edit.createdAt,
            authorId: edit.author?.[0]?.id || "unknown",
          });
        } catch {
          continue;
        }
      }

      decrypted.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      setEdits(decrypted);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load edits");
    } finally {
      setLoading(false);
    }
  }, [documentId, docKey, identity]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addEdit = useCallback(
    async (content: string) => {
      if (!documentId || !docKey || !identity) {
        throw new Error("Missing document context");
      }

      const nextSeq =
        edits.length > 0
          ? Math.max(...edits.map((e) => e.sequenceNumber)) + 1
          : 0;

      // Encrypt the content
      const encrypted = await symmetricEncrypt(content, docKey);

      // Sign the encrypted content
      const signatureData = new TextEncoder().encode(encrypted.ciphertext);
      const signature = await sign(
        signatureData,
        identity.keyPair.signing.privateKey,
      );

      await api(`/documents/${documentId}/edits`, {
        method: "POST",
        identity,
        body: {
          encryptedContent: encrypted.ciphertext,
          encryptedContentIv: encrypted.iv,
          signature,
          sequenceNumber: nextSeq,
          algorithm: encrypted.algorithm,
        },
      });

      await refresh();
    },
    [documentId, docKey, identity, edits, refresh],
  );

  return { edits, loading, loaded, error, refresh, addEdit };
}
