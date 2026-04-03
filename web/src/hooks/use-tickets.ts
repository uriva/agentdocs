"use client";

// React hooks for ticket operations
// Same E2EE pattern as use-documents.ts — encrypt/decrypt client-side, API for persistence

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

export type TicketStatus = "open" | "in_progress" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface TicketHeader {
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: number;
  updatedAt: number;
  /** Decrypted ticket symmetric key (in memory only) */
  ticketKey: string;
}

interface RawTicket {
  id: string;
  encryptedTitle: string;
  encryptedTitleIv: string;
  encryptedBody: string;
  encryptedBodyIv: string;
  status: string;
  priority: string;
  algorithm: string;
  createdAt: number;
  updatedAt: number;
  accessGrants: Array<{
    id: string;
    encryptedSymmetricKey: string;
    iv: string;
    salt: string;
    algorithm: string;
    grantor: Array<{ id: string; encryptionPublicKey: string }>;
  }>;
}

export interface TicketComment {
  id: string;
  content: string;
  createdAt: number;
  authorId: string;
}

interface RawComment {
  id: string;
  encryptedContent: string;
  encryptedContentIv: string;
  algorithm: string;
  signature: string;
  createdAt: number;
  author: Array<{ id: string }>;
}

// ─── useTickets: list tickets for the active identity ────────────────────────

export function useTickets(identity: StoredIdentity | null) {
  const [tickets, setTickets] = useState<TicketHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!identity) {
      setTickets([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ tickets: RawTicket[] }>("/tickets", {
        identity,
      });

      const decrypted: TicketHeader[] = [];
      for (const ticket of res.tickets) {
        const grant = ticket.accessGrants?.find(
          (g) => g.grantor?.length > 0,
        );
        if (!grant || !grant.grantor?.[0]) continue;

        try {
          const ticketKey = await decryptAccessGrant(
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
              ciphertext: ticket.encryptedTitle,
              iv: ticket.encryptedTitleIv,
              algorithm: ticket.algorithm,
            },
            ticketKey,
          );

          decrypted.push({
            id: ticket.id,
            title,
            status: ticket.status as TicketStatus,
            priority: ticket.priority as TicketPriority,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            ticketKey,
          });
        } catch {
          // Can't decrypt — wrong key or corrupt grant, skip
          continue;
        }
      }

      decrypted.sort((a, b) => b.createdAt - a.createdAt);
      setTickets(decrypted);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load tickets",
      );
    } finally {
      setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTicket = useCallback(
    async (
      title: string,
      body: string,
      priority: TicketPriority = "medium",
    ) => {
      if (!identity) throw new Error("No active identity");

      // 1. Generate ticket symmetric key
      const ticketKey = await generateDocumentKey();

      // 2. Encrypt title and body
      const encTitle = await symmetricEncrypt(title, ticketKey);
      const encBody = await symmetricEncrypt(body, ticketKey);

      // 3. Create self-grant
      const grant = await cryptoCreateAccessGrant(
        ticketKey,
        identity.keyPair.encryption.privateKey,
        identity.keyPair.encryption.publicKey,
      );

      // 4. Send to API
      const res = await api<{ ticket: { id: string } }>("/tickets", {
        method: "POST",
        identity,
        body: {
          encryptedTitle: encTitle.ciphertext,
          encryptedTitleIv: encTitle.iv,
          encryptedBody: encBody.ciphertext,
          encryptedBodyIv: encBody.iv,
          status: "open",
          priority,
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
      return res.ticket.id;
    },
    [identity, refresh],
  );

  return { tickets, loading, error, refresh, createTicket };
}

// ─── useTicketDetail: load a specific ticket's body + comments ──────────────

export function useTicketDetail(
  ticketId: string | null,
  ticketKey: string | null,
  identity: StoredIdentity | null,
) {
  const [body, setBody] = useState<string | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load and decrypt the ticket body from the tickets list endpoint
  // (the list endpoint returns the encrypted body too)
  const refreshBody = useCallback(async () => {
    if (!ticketId || !ticketKey || !identity) {
      setBody(null);
      return;
    }
    try {
      const res = await api<{ tickets: RawTicket[] }>("/tickets", {
        identity,
      });
      const ticket = res.tickets.find((t) => t.id === ticketId);
      if (!ticket) {
        setBody(null);
        return;
      }
      const decryptedBody = await symmetricDecrypt(
        {
          ciphertext: ticket.encryptedBody,
          iv: ticket.encryptedBodyIv,
          algorithm: ticket.algorithm,
        },
        ticketKey,
      );
      setBody(decryptedBody);
    } catch {
      // Decryption failure
      setBody(null);
    }
  }, [ticketId, ticketKey, identity]);

  // Load and decrypt comments
  const refreshComments = useCallback(async () => {
    if (!ticketId || !ticketKey || !identity) {
      setComments([]);
      return;
    }
    try {
      const res = await api<{ comments: RawComment[] }>(
        `/tickets/${ticketId}/comments`,
        { identity },
      );

      const decrypted: TicketComment[] = [];
      for (const comment of res.comments) {
        try {
          const content = await symmetricDecrypt(
            {
              ciphertext: comment.encryptedContent,
              iv: comment.encryptedContentIv,
              algorithm: comment.algorithm,
            },
            ticketKey,
          );
          decrypted.push({
            id: comment.id,
            content,
            createdAt: comment.createdAt,
            authorId: comment.author?.[0]?.id || "unknown",
          });
        } catch {
          continue;
        }
      }
      decrypted.sort((a, b) => a.createdAt - b.createdAt);
      setComments(decrypted);
    } catch {
      // ignore
    }
  }, [ticketId, ticketKey, identity]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([refreshBody(), refreshComments()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load ticket",
      );
    } finally {
      setLoading(false);
    }
  }, [refreshBody, refreshComments]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addComment = useCallback(
    async (content: string) => {
      if (!ticketId || !ticketKey || !identity) {
        throw new Error("Missing ticket context");
      }

      const encrypted = await symmetricEncrypt(content, ticketKey);
      const signatureData = new TextEncoder().encode(encrypted.ciphertext);
      const signature = await sign(
        signatureData,
        identity.keyPair.signing.privateKey,
      );

      await api(`/tickets/${ticketId}/comments`, {
        method: "POST",
        identity,
        body: {
          encryptedContent: encrypted.ciphertext,
          encryptedContentIv: encrypted.iv,
          signature,
          algorithm: encrypted.algorithm,
        },
      });

      await refreshComments();
    },
    [ticketId, ticketKey, identity, refreshComments],
  );

  const updateStatus = useCallback(
    async (status: TicketStatus) => {
      if (!ticketId || !identity) throw new Error("Missing ticket context");
      await api(`/tickets/${ticketId}`, {
        method: "PATCH",
        identity,
        body: { status },
      });
    },
    [ticketId, identity],
  );

  const updatePriority = useCallback(
    async (priority: TicketPriority) => {
      if (!ticketId || !identity) throw new Error("Missing ticket context");
      await api(`/tickets/${ticketId}`, {
        method: "PATCH",
        identity,
        body: { priority },
      });
    },
    [ticketId, identity],
  );

  return {
    body,
    comments,
    loading,
    error,
    refresh,
    addComment,
    updateStatus,
    updatePriority,
  };
}
