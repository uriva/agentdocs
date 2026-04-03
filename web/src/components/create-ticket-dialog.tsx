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
import type { TicketPriority } from "@/hooks/use-tickets";

interface CreateTicketDialogProps {
  onCreateTicket: (
    title: string,
    body: string,
    priority: TicketPriority,
  ) => Promise<string>;
  trigger: React.ReactNode;
}

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function CreateTicketDialog({
  onCreateTicket,
  trigger,
}: CreateTicketDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await onCreateTicket(title.trim(), body.trim(), priority);
      handleClose();
    } catch {
      // toast handled by caller
    } finally {
      setCreating(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setTitle("");
      setBody("");
      setPriority("medium");
      setCreating(false);
    }, 200);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
    >
      <DialogTrigger render={trigger as React.ReactElement}>
        {undefined}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg tracking-tight">
            New Ticket
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Create an encrypted ticket. Title and body are E2EE — only
            identities with access can read them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label
              htmlFor="ticket-title"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Title
            </Label>
            <Input
              id="ticket-title"
              placeholder="Ticket title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleCreate()
              }
              className="h-10 text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="ticket-body"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Description
            </Label>
            <textarea
              id="ticket-body"
              placeholder="Describe the issue... (Markdown supported)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Priority
            </Label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    priority === p.value
                      ? "border-foreground/40 bg-foreground/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || creating}
            className="w-full h-10"
          >
            {creating ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Creating...
              </span>
            ) : (
              "Create Ticket"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
