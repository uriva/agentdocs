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
} from "@/lib/crypto";
import type { StoredIdentity } from "@/lib/identity-store";
import { emptySpreadsheet, type SpreadsheetData } from "@/lib/spreadsheet";

export interface DocumentHeader {
  id: string;
  kind: string;
  title: string;
  createdAt: number;
  /** Decrypted document symmetric key (in memory only) */
  docKey: string;
}

interface RawDocument {
  id: string;
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
  raw: string;
  snapshot: Record<string, unknown> | null;
  content: string;
  title: string;
  kind: string;
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

type SnapshotLike = {
  kind?: string;
  type?: string;
  title?: string;
  content?: string;
  data?: SpreadsheetData;
};

function parseSnapshot(raw: string): SnapshotLike | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as SnapshotLike;
    }
  } catch {
    // Keep backward compatibility with legacy plain markdown edits.
  }
  return null;
}

function snapshotKind(snapshot: SnapshotLike | null): string {
  if (!snapshot) return "doc";
  if (typeof snapshot.kind === "string") return snapshot.kind;
  if (typeof snapshot.type === "string") return snapshot.type;
  return "doc";
}

function snapshotTitle(snapshot: SnapshotLike | null): string {
  if (!snapshot) return "Untitled Document";
  if (typeof snapshot.title === "string" && snapshot.title.trim()) {
    return snapshot.title;
  }
  return "Untitled Document";
}

function snapshotContent(snapshot: SnapshotLike | null, raw: string): string {
  if (!snapshot) return raw;
  const kind = snapshotKind(snapshot);
  if (kind === "spreadsheet") {
    return JSON.stringify(snapshot.data ?? emptySpreadsheet());
  }
  if (typeof snapshot.content === "string") return snapshot.content;
  return raw;
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
        const grant = doc.accessGrants?.find((g: RawDocument["accessGrants"][number]) =>
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

          const editsRes = await api<{ edits: RawEdit[] }>(
            `/documents/${doc.id}/edits`,
            { identity },
          );
          const latest = editsRes.edits[editsRes.edits.length - 1];
          let title = "Untitled Document";
          let kind = "doc";
          if (latest) {
            const decryptedLatest = await symmetricDecrypt(
              {
                ciphertext: latest.encryptedContent,
                iv: latest.encryptedContentIv,
                algorithm: latest.algorithm,
              },
              docKey,
            );
            const snapshot = parseSnapshot(decryptedLatest);
            title = snapshotTitle(snapshot);
            kind = snapshotKind(snapshot);
          }

          decrypted.push({
            id: doc.id,
            kind,
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
    async (title: string, kind: "doc" | "spreadsheet" = "doc") => {
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
          algorithm: encTitle.algorithm,
          accessGrant: {
            encryptedSymmetricKey: grant.encryptedSymmetricKey,
            iv: grant.iv,
            salt: grant.salt,
            algorithm: JSON.stringify(grant.algorithm),
          },
        },
      });

      const initialSnapshot =
        kind === "spreadsheet"
          ? JSON.stringify({ kind: "spreadsheet", title, data: emptySpreadsheet() })
          : JSON.stringify({ kind: "doc", title, content: "" });

      const encrypted = await symmetricEncrypt(initialSnapshot, docKey);
      const signatureData = new TextEncoder().encode(initialSnapshot);
      const signature = await sign(
        signatureData,
        identity.keyPair.signing.privateKey,
      );

      await api(`/documents/${res.document.id}/edits`, {
        method: "POST",
        identity,
        body: {
          encryptedContent: encrypted.ciphertext,
          encryptedContentIv: encrypted.iv,
          signature,
          sequenceNumber: 0,
          algorithm: encrypted.algorithm,
        },
      });

      await refresh();
      return res.document.id;
    },
    [identity, refresh],
  );

  return { documents, loading, error, refresh, createDocument };
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
          const snapshot = parseSnapshot(content);
          decrypted.push({
            id: edit.id,
            raw: content,
            snapshot: snapshot as Record<string, unknown> | null,
            content: snapshotContent(snapshot, content),
            title: snapshotTitle(snapshot),
            kind: snapshotKind(snapshot),
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
          ? Math.max(...edits.map((e: DocumentEdit) => e.sequenceNumber)) + 1
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
