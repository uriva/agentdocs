"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Check, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import {
  createAccessGrant as cryptoCreateAccessGrant,
  ALGORITHMS,
} from "@/lib/crypto";
import type { StoredIdentity } from "@/lib/identity-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface ShareDialogProps {
  documentId: string;
  docKey: string;
  identity: StoredIdentity;
}

export function ShareDialog({ documentId, docKey, identity }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [granteeId, setGranteeId] = useState("");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleShare() {
    if (!granteeId.trim()) return;
    setSharing(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Look up the grantee's public encryption key
      const granteeInfo = await api<{
        identity: {
          id: string;
          encryptionPublicKey: string;
          signingPublicKey: string;
        };
      }>(`/identities/${granteeId.trim()}`, { identity });

      if (!granteeInfo.identity?.encryptionPublicKey) {
        throw new Error("Identity not found or missing encryption key");
      }

      // 2. Create access grant (ECDH key wrapping)
      const grant = await cryptoCreateAccessGrant(
        docKey,
        identity.keyPair.encryption.privateKey,
        granteeInfo.identity.encryptionPublicKey,
      );

      // 3. Send to API
      await api(`/documents/${documentId}/share`, {
        method: "POST",
        identity,
        body: {
          granteeIdentityId: granteeId.trim(),
          encryptedSymmetricKey: grant.encryptedSymmetricKey,
          iv: grant.iv,
          salt: grant.salt,
          algorithm: JSON.stringify(grant.algorithm),
        },
      });

      setSuccess(true);
      setGranteeId("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to share document",
      );
    } finally {
      setSharing(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setGranteeId("");
      setError(null);
      setSuccess(false);
      setSharing(false);
    }, 200);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
      >
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg tracking-tight">
            Share Document
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Grant access to another identity. The document key will be
            encrypted using ECDH key agreement — only the recipient can decrypt
            it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label
              htmlFor="grantee-id"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Recipient Identity ID
            </Label>
            <Input
              id="grantee-id"
              placeholder="Paste the identity ID..."
              value={granteeId}
              onChange={(e) => {
                setGranteeId(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleShare()}
              className="h-10 font-mono text-xs"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Check className="h-4 w-4 shrink-0" />
              <span>Access granted. The recipient can now decrypt this document.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleShare}
            disabled={!granteeId.trim() || sharing}
            className="w-full h-10"
          >
            {sharing ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Creating access grant...
              </span>
            ) : (
              "Grant Access"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
}
