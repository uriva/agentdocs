"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fingerprint, type StoredIdentity } from "@/lib/identity-store";
import { exportIdentity } from "@/lib/crypto";

interface CreateIdentityDialogProps {
  onCreateIdentity: (name: string) => Promise<StoredIdentity>;
  trigger?: React.ReactNode;
}

export function CreateIdentityDialog({
  onCreateIdentity,
  trigger,
}: CreateIdentityDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<StoredIdentity | null>(null);
  const [exportString, setExportString] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const identity = await onCreateIdentity(name.trim());
      setCreated(identity);
      setExportString(exportIdentity(identity.keyPair));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create identity");
    } finally {
      setCreating(false);
    }
  }

  function handleCopy() {
    if (exportString) {
      navigator.clipboard.writeText(exportString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClose() {
    setOpen(false);
    // Reset state after animation
    setTimeout(() => {
      setName("");
      setCreating(false);
      setError(null);
      setCreated(null);
      setExportString(null);
      setCopied(false);
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger
        render={
          trigger ? (
            trigger as React.ReactElement
          ) : (
            <Button variant="outline" size="sm" />
          )
        }
      >
        {trigger ? undefined : "New Identity"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg tracking-tight">
                Create Identity
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                Generate a new cryptographic identity. A key pair will be created
                in your browser — private keys never leave this device.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="identity-name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="identity-name"
                  placeholder="e.g. My Laptop, Production Agent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                  className="h-10"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                className="w-full h-10"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating keys...
                  </span>
                ) : (
                  "Generate Keys"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg tracking-tight">
                Identity Created
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                Save your private key backup. This is the <strong>only time</strong>{" "}
                it will be shown. Anyone with this key can act as this identity.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Identity
                </p>
                <p className="text-sm font-medium">{created.name}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Fingerprint
                </p>
                <code className="block text-xs font-mono bg-muted px-2.5 py-1.5 rounded-md">
                  {fingerprint(created.keyPair.signing.publicKey)}
                </code>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Private Key Backup
                </p>
                <div className="relative">
                  <code className="block text-[10px] font-mono bg-muted px-2.5 py-2 rounded-md break-all leading-relaxed max-h-20 overflow-y-auto">
                    {exportString}
                  </code>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={handleCopy} variant="outline" className="w-full h-10">
                {copied ? "Copied" : "Copy Backup Key"}
              </Button>
              <Button onClick={handleClose} className="w-full h-10">
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
