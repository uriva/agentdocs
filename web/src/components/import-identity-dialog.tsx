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
import { importIdentity } from "@/lib/crypto";
import { fingerprint } from "@/lib/identity-store";
import { Download, AlertTriangle, Loader2 } from "lucide-react";

interface ImportIdentityDialogProps {
  onImport: (data: {
    id: string;
    name: string;
    keyPair: Awaited<ReturnType<typeof importIdentity>>["keyPair"];
  }) => void;
  trigger?: React.ReactNode;
}

type ImportState =
  | { step: "input" }
  | { step: "parsing" }
  | {
      step: "confirm";
      data: Awaited<ReturnType<typeof importIdentity>>;
    }
  | { step: "error"; message: string };

export function ImportIdentityDialog({
  onImport,
  trigger,
}: ImportIdentityDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ImportState>({ step: "input" });
  const [input, setInput] = useState("");

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setState({ step: "input" });
      setInput("");
    }, 200);
  }

  async function handleParse() {
    const trimmed = input.trim();
    if (!trimmed) return;

    setState({ step: "parsing" });

    try {
      // Strip URL prefix if present (e.g. https://.../#import/DATA)
      let exportData = trimmed;
      const fragmentIdx = exportData.indexOf("#import/");
      if (fragmentIdx !== -1) {
        exportData = exportData.slice(fragmentIdx + "#import/".length);
      }

      const result = await importIdentity(exportData);
      setState({ step: "confirm", data: result });
    } catch {
      setState({
        step: "error",
        message:
          "Invalid export data. Make sure you copied the full export key or share link.",
      });
    }
  }

  function handleConfirm() {
    if (state.step !== "confirm") return;
    onImport(state.data);
    handleClose();
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
        {trigger ? undefined : "Import"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg tracking-tight">
            Import Identity
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Paste an export key or share link to import an existing identity onto
            this device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {state.step === "input" || state.step === "error" ? (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="import-input"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Export Key or Link
                </label>
                <textarea
                  id="import-input"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (state.step === "error") setState({ step: "input" });
                  }}
                  placeholder="Paste export key or agentdocs share link..."
                  className="w-full min-h-[80px] rounded-md bg-muted border border-border px-2.5 py-2 text-xs font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-terminal/50 resize-none"
                  autoFocus
                />
              </div>

              {state.step === "error" && (
                <div className="rounded-md bg-destructive/5 border border-destructive/10 px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive/80 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-destructive/80 leading-relaxed">
                    {state.message}
                  </p>
                </div>
              )}
            </>
          ) : state.step === "parsing" ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : state.step === "confirm" ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-terminal/80 shrink-0" />
                  <span className="text-sm font-medium truncate flex-1">
                    {state.data.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  <span>
                    signing:{" "}
                    {fingerprint(state.data.keyPair.signing.publicKey)}
                  </span>
                  <span className="text-muted-foreground/30">|</span>
                  <span>id: {state.data.id.slice(0, 12)}...</span>
                </div>
              </div>

              <div className="rounded-md bg-destructive/5 border border-destructive/10 px-3 py-2">
                <p className="text-[11px] text-destructive/80 leading-relaxed">
                  This will add the identity to this device. If an identity with
                  the same ID already exists locally, it will be replaced.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {state.step === "confirm" ? (
            <div className="flex items-center gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => {
                  setState({ step: "input" });
                  setInput("");
                }}
                className="flex-1 h-10"
              >
                Back
              </Button>
              <Button onClick={handleConfirm} className="flex-1 h-10 gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Import
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleParse}
              disabled={!input.trim() || state.step === "parsing"}
              className="w-full h-10"
            >
              {state.step === "parsing" ? "Parsing..." : "Continue"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
