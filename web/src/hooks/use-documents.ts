"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import db from "@/lib/db";
import { api } from "@/lib/api";
import {
  generateDocumentKey,
  symmetricEncrypt,
  symmetricDecrypt,
  createAccessGrant as cryptoCreateAccessGrant,
  decryptAccessGrant,
  sign,
  sha256Text,
  ALGORITHMS,
} from "@/lib/crypto";
import type { StoredIdentity } from "@/lib/identity-store";
import { emptySpreadsheet, type SpreadsheetData } from "@/lib/spreadsheet";

export interface DocumentHeader {
  id: string;
  kind: string;
  title: string;
  createdAt: number;
  docKey: string;
}

interface RawDocument {
  id: string;
  algorithm: string;
  encryptedSnapshot: string;
  encryptedSnapshotIv: string;
  snapshotHash: string;
  snapshotSequenceNumber: number;
  createdAt: number;
  accessGrants: Array<{
    id: string;
    encryptedSymmetricKey: string;
    iv: string;
    salt: string;
    algorithm: string;
    grantor: Array<{ id: string; encryptionPublicKey: string }>;
    grantee: Array<{ id: string }>;
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
  encryptedPatch: string;
  encryptedPatchIv: string;
  algorithm: string;
  signature: string;
  baseSequenceNumber: number;
  resultingSnapshotHash: string;
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

function tryExtractContent(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.content === "string") {
      return parsed.content;
    }
  } catch {
    // not JSON
  }
  return null;
}

function snapshotContent(snapshot: SnapshotLike | null, raw: string): string {
  if (!snapshot) {
    const extracted = tryExtractContent(raw);
    if (extracted !== null) return extracted;
    return raw;
  }
  const kind = snapshotKind(snapshot);
  if (kind === "spreadsheet") {
    return JSON.stringify(snapshot.data ?? emptySpreadsheet());
  }
  if (typeof snapshot.content === "string") {
    const inner = tryExtractContent(snapshot.content);
    if (inner !== null) return inner;
    return snapshot.content;
  }
  const extracted = tryExtractContent(raw);
  if (extracted !== null) return extracted;
  return raw;
}

function parsePatchToSnapshot(patchRaw: string): SnapshotLike | null {
  try {
    const parsed = JSON.parse(patchRaw) as {
      type?: string;
      snapshot?: string | Record<string, unknown>;
    };
    if (parsed && parsed.type === "replace_snapshot") {
      if (typeof parsed.snapshot === "string") {
        return parseSnapshot(parsed.snapshot);
      }
      if (parsed.snapshot && typeof parsed.snapshot === "object") {
        return parsed.snapshot as SnapshotLike;
      }
    }
  } catch {
    // Fall back to interpreting as raw snapshot for backward compatibility.
  }
  return parseSnapshot(patchRaw);
}

async function decryptDocumentHeader(
  doc: { id: string; algorithm: string; encryptedSnapshot: string; encryptedSnapshotIv: string; createdAt: number },
  grant: { encryptedSymmetricKey: string; iv: string; salt: string; algorithm: string; grantor: Array<{ id: string; encryptionPublicKey: string }> },
  identity: StoredIdentity,
): Promise<DocumentHeader | null> {
  if (!grant.grantor?.[0]) return null;

  try {
    const docKey = await decryptAccessGrant(
      {
        encryptedSymmetricKey: grant.encryptedSymmetricKey,
        iv: grant.iv,
        salt: grant.salt,
        algorithm: typeof grant.algorithm === "string"
          ? JSON.parse(grant.algorithm)
          : ALGORITHMS,
      },
      identity.keyPair.encryption.privateKey,
      grant.grantor[0].encryptionPublicKey,
    );

    const decryptedLatest = await symmetricDecrypt(
      {
        ciphertext: doc.encryptedSnapshot,
        iv: doc.encryptedSnapshotIv,
        algorithm: doc.algorithm,
      },
      docKey,
    );
    let title = "Untitled Document";
    let kind = "doc";
    const snapshot = parseSnapshot(decryptedLatest);
    title = snapshotTitle(snapshot);
    kind = snapshotKind(snapshot);

    return {
      id: doc.id,
      kind,
      title,
      createdAt: doc.createdAt,
      docKey,
    };
  } catch {
    return null;
  }
}

async function decryptEdit(
  edit: RawEdit,
  docKey: string,
): Promise<DocumentEdit | null> {
  try {
    const patchRaw = await symmetricDecrypt(
      {
        ciphertext: edit.encryptedPatch,
        iv: edit.encryptedPatchIv,
        algorithm: edit.algorithm,
      },
      docKey,
    );
    const snapshot = parsePatchToSnapshot(patchRaw);
    return {
      id: edit.id,
      raw: patchRaw,
      snapshot: snapshot as Record<string, unknown> | null,
      content: snapshotContent(snapshot, patchRaw),
      title: snapshotTitle(snapshot),
      kind: snapshotKind(snapshot),
      sequenceNumber: edit.sequenceNumber,
      createdAt: edit.createdAt,
      authorId: edit.author?.[0]?.id || "unknown",
    };
  } catch {
    return null;
  }
}

// ─── useDocuments: list documents for the active identity ────────────────────

export function useDocuments(identity: StoredIdentity | null) {
  const [documents, setDocuments] = useState<DocumentHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const liveSourcesRef = useRef(new Set<string>());

  const queryId = identity?.id || "__none__";

  const { data: liveData, isLoading: dbLoading } = db.useQuery({
    accessGrants: {
      $: { where: { "grantee.id": queryId } },
      grantor: {},
      document: {},
    },
  });

  useEffect(() => {
    if (!identity || !liveData) return;
    const grantsRaw = (liveData as Record<string, unknown>)?.accessGrants as Array<Record<string, unknown>> | undefined;
    if (!grantsRaw?.length) return;

    let cancelled = false;
    (async () => {
      const decrypted: DocumentHeader[] = [];
      const processed = new Set<string>();

      for (const grant of grantsRaw) {
        const doc = (grant.document as Array<Record<string, unknown>>)?.[0];
        const grantor = (grant.grantor as Array<Record<string, unknown>>) || [];
        if (!doc || !doc.id) continue;

        const docId = doc.id as string;
        if (processed.has(docId)) continue;
        processed.add(docId);

        const header = await decryptDocumentHeader(
          {
            id: docId,
            algorithm: (doc.algorithm as string) || "",
            encryptedSnapshot: (doc.encryptedSnapshot as string) || "",
            encryptedSnapshotIv: (doc.encryptedSnapshotIv as string) || "",
            createdAt: (doc.createdAt as number) || 0,
          },
          {
            encryptedSymmetricKey: (grant.encryptedSymmetricKey as string) || "",
            iv: (grant.iv as string) || "",
            salt: (grant.salt as string) || "",
            algorithm: (grant.algorithm as string) || "",
            grantor: grantor.map((g) => ({
              id: (g.id as string) || "",
              encryptionPublicKey: (g.encryptionPublicKey as string) || "",
            })),
          },
          identity,
        );
        if (header) {
          decrypted.push(header);
          liveSourcesRef.current.add(header.id);
        }
      }

      if (cancelled) return;
      decrypted.sort((a, b) => b.createdAt - a.createdAt);
      setDocuments(decrypted);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [liveData, identity]);

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
        if (liveSourcesRef.current.has(doc.id)) continue;
        const grant = doc.accessGrants?.find((g: RawDocument["accessGrants"][number]) =>
          g.grantor?.length > 0,
        );
        if (!grant || !grant.grantor?.[0]) continue;

        try {
          const docKey = await decryptAccessGrant(
            {
              encryptedSymmetricKey: grant.encryptedSymmetricKey,
              iv: grant.iv,
              salt: grant.salt,
              algorithm: typeof grant.algorithm === "string"
                ? JSON.parse(grant.algorithm)
                : ALGORITHMS,
            },
            identity.keyPair.encryption.privateKey,
            grant.grantor[0].encryptionPublicKey,
          );

          const decryptedLatest = await symmetricDecrypt(
            {
              ciphertext: doc.encryptedSnapshot,
              iv: doc.encryptedSnapshotIv,
              algorithm: doc.algorithm,
            },
            docKey,
          );
          let title = "Untitled Document";
          let kind = "doc";
          const snapshot = parseSnapshot(decryptedLatest);
          title = snapshotTitle(snapshot);
          kind = snapshotKind(snapshot);

          decrypted.push({
            id: doc.id,
            kind,
            title,
            createdAt: doc.createdAt,
            docKey,
          });
        } catch {
          continue;
        }
      }

      if (decrypted.length === 0) {
        setLoading(false);
        return;
      }

      decrypted.sort((a, b) => b.createdAt - a.createdAt);
      setDocuments((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        const merged = [...prev];
        for (const d of decrypted) {
          if (!existingIds.has(d.id)) merged.push(d);
        }
        merged.sort((a, b) => b.createdAt - a.createdAt);
        return merged;
      });
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

      const docKey = await generateDocumentKey();

      const initialSnapshot =
        kind === "spreadsheet"
          ? JSON.stringify({ kind: "spreadsheet", title, data: emptySpreadsheet() })
          : JSON.stringify({ kind: "doc", title, content: "" });

      const encSnapshot = await symmetricEncrypt(initialSnapshot, docKey);
      const initialHash = await sha256Text(initialSnapshot);

      const grant = await cryptoCreateAccessGrant(
        docKey,
        identity.keyPair.encryption.privateKey,
        identity.keyPair.encryption.publicKey,
      );

      const res = await api<{ document: { id: string } }>("/documents", {
        method: "POST",
        identity,
        body: {
          algorithm: encSnapshot.algorithm,
          encryptedSnapshot: encSnapshot.ciphertext,
          encryptedSnapshotIv: encSnapshot.iv,
          snapshotHash: initialHash,
          accessGrant: {
            encryptedSymmetricKey: grant.encryptedSymmetricKey,
            iv: grant.iv,
            salt: grant.salt,
            algorithm: JSON.stringify(grant.algorithm),
          },
        },
      });

      const initialPatch = JSON.stringify({
        type: "replace_snapshot",
        snapshot: initialSnapshot,
      });
      const encryptedPatch = await symmetricEncrypt(initialPatch, docKey);
      const signatureData = new TextEncoder().encode(initialPatch);
      const signature = await sign(
        signatureData,
        identity.keyPair.signing.privateKey,
      );

      await api(`/documents/${res.document.id}/edits`, {
        method: "POST",
        identity,
        body: {
          encryptedPatch: encryptedPatch.ciphertext,
          encryptedPatchIv: encryptedPatch.iv,
          signature,
          baseSequenceNumber: 0,
          sequenceNumber: 1,
          resultingSnapshotHash: initialHash,
          encryptedResultingSnapshot: encSnapshot.ciphertext,
          encryptedResultingSnapshotIv: encSnapshot.iv,
          algorithm: encryptedPatch.algorithm,
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

  const editsQueryId = documentId || "__none__";

  const { data: liveData } = db.useQuery({
    documents: {
      $: { where: { id: editsQueryId } },
      edits: {
        $: { order: { sequenceNumber: "asc" as const } },
        author: {},
      },
    },
  });
  const liveEditsProcessed = useRef(false);

  useEffect(() => {
    liveEditsProcessed.current = false;
  }, [documentId]);

  useEffect(() => {
    if (!documentId || !docKey || !identity) return;
    if (!liveData) return;

    const docs = (liveData as Record<string, unknown>)?.documents as Array<Record<string, unknown>> | undefined;
    if (!docs?.length) return;

    const doc = docs[0];
    const editsRaw = (doc.edits as Array<Record<string, unknown>>) || [];
    if (!editsRaw.length) return;

    let cancelled = false;
    (async () => {
      const decrypted: DocumentEdit[] = [];
      for (const edit of editsRaw) {
        const result = await decryptEdit(
          {
            id: edit.id as string,
            encryptedPatch: edit.encryptedPatch as string,
            encryptedPatchIv: edit.encryptedPatchIv as string,
            algorithm: edit.algorithm as string,
            signature: edit.signature as string,
            baseSequenceNumber: edit.baseSequenceNumber as number,
            resultingSnapshotHash: edit.resultingSnapshotHash as string,
            sequenceNumber: edit.sequenceNumber as number,
            createdAt: edit.createdAt as number,
            author: (edit.author as Array<{ id: string }>) || [],
          },
          docKey,
        );
        if (result) decrypted.push(result);
      }
      if (cancelled) return;
      decrypted.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      setEdits(decrypted);
      setLoaded(true);
      setLoading(false);
      liveEditsProcessed.current = true;
    })();

    return () => { cancelled = true; };
  }, [liveData, documentId, docKey, identity]);

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
        const result = await decryptEdit(edit, docKey);
        if (result) decrypted.push(result);
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
    async (newSnapshotJson: string) => {
      if (!documentId || !docKey || !identity) {
        throw new Error("Missing document context");
      }

      const baseSeq =
        edits.length > 0
          ? Math.max(...edits.map((e: DocumentEdit) => e.sequenceNumber))
          : 0;
      const nextSeq = baseSeq + 1;

      const patch = JSON.stringify({
        type: "replace_snapshot",
        snapshot: newSnapshotJson,
      });
      const resultHash = await sha256Text(newSnapshotJson);

      const encryptedPatch = await symmetricEncrypt(patch, docKey);
      const encryptedSnapshot = await symmetricEncrypt(newSnapshotJson, docKey);

      const signatureData = new TextEncoder().encode(patch);
      const signature = await sign(
        signatureData,
        identity.keyPair.signing.privateKey,
      );

      await api(`/documents/${documentId}/edits`, {
        method: "POST",
        identity,
        body: {
          encryptedPatch: encryptedPatch.ciphertext,
          encryptedPatchIv: encryptedPatch.iv,
          signature,
          baseSequenceNumber: baseSeq,
          sequenceNumber: nextSeq,
          resultingSnapshotHash: resultHash,
          encryptedResultingSnapshot: encryptedSnapshot.ciphertext,
          encryptedResultingSnapshotIv: encryptedSnapshot.iv,
          algorithm: encryptedPatch.algorithm,
        },
      });

      await refresh();
    },
    [documentId, docKey, identity, edits, refresh],
  );

  return { edits, loading, loaded, error, refresh, addEdit };
}
