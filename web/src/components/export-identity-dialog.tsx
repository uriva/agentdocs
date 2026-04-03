"use client";

import { useState, useMemo } from "react";
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
import { type StoredIdentity, fingerprint } from "@/lib/identity-store";
import { exportIdentity } from "@/lib/crypto";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode, Link2 } from "lucide-react";

interface ExportIdentityDialogProps {
  identity: StoredIdentity;
  trigger?: React.ReactNode;
}

export function ExportIdentityDialog({
  identity,
  trigger,
}: ExportIdentityDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"key" | "link" | null>(null);
  const [view, setView] = useState<"qr" | "text">("qr");

  const exportString = useMemo(
    () => exportIdentity(identity.id, identity.name, identity.keyPair),
    [identity],
  );

  const shareLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/#import/${exportString}`;
  }, [exportString]);

  function handleCopy(type: "key" | "link") {
    const text = type === "key" ? exportString : shareLink;
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setCopied(null);
      setView("qr");
    }, 200);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
    >
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button variant="outline" size="sm" />
          )
        }
      >
        {trigger ? undefined : "Export"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg tracking-tight">
            Export Identity
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Share this identity with another device or agent. Anyone with this
            data can act as{" "}
            <span className="font-medium text-foreground/80">
              {identity.name}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Identity info */}
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 border border-border px-3 py-2.5">
            <span className="h-2 w-2 rounded-full bg-terminal/80 shrink-0" />
            <span className="text-sm font-medium truncate flex-1">
              {identity.name}
            </span>
            <code className="text-[10px] font-mono text-muted-foreground">
              {fingerprint(identity.keyPair.signing.publicKey)}
            </code>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-muted/30 border border-border p-0.5">
            <button
              onClick={() => setView("qr")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "qr"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <QrCode className="h-3 w-3" />
              QR Code
            </button>
            <button
              onClick={() => setView("text")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "text"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link2 className="h-3 w-3" />
              Link / Key
            </button>
          </div>

          {view === "qr" ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG
                  value={shareLink}
                  size={200}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0a0a0a"
                />
              </div>
              <p className="text-[11px] text-muted-foreground/60 text-center">
                Scan with another device to import this identity
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Share link */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Share Link
                </p>
                <div className="relative">
                  <code className="block text-[10px] font-mono bg-muted px-2.5 py-2 rounded-md break-all leading-relaxed max-h-16 overflow-y-auto pr-16">
                    {shareLink}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0"
                    onClick={() => handleCopy("link")}
                  >
                    {copied === "link" ? (
                      <Check className="h-3 w-3 text-terminal" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/50">
                  The fragment (#) never leaves the browser
                </p>
              </div>

              {/* Raw key */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Raw Export Key
                </p>
                <div className="relative">
                  <code className="block text-[10px] font-mono bg-muted px-2.5 py-2 rounded-md break-all leading-relaxed max-h-16 overflow-y-auto pr-16">
                    {exportString}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0"
                    onClick={() => handleCopy("key")}
                  >
                    {copied === "key" ? (
                      <Check className="h-3 w-3 text-terminal" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/50">
                  For agents: paste directly or use as env var
                </p>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="rounded-md bg-destructive/5 border border-destructive/10 px-3 py-2">
            <p className="text-[11px] text-destructive/80 leading-relaxed">
              This export contains private keys. Anyone with it can sign
              requests and decrypt documents as this identity.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full h-10">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
