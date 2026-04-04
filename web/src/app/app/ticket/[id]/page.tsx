"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useIdentity } from "@/hooks/use-identity";
import {
  useTicketDetail,
  type TicketStatus,
  type TicketPriority,
} from "@/hooks/use-tickets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Lock,
  User,
  Share2,
  CircleDot,
  ArrowUpCircle,
  CheckCircle2,
  MessageSquare,
  Send,
  AlertCircle,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import {
  createAccessGrant as cryptoCreateAccessGrant,
} from "@/lib/crypto";
import type { StoredIdentity } from "@/lib/identity-store";
import { toast } from "sonner";

interface TicketContext {
  title: string;
  ticketKey: string;
}

function getTicketContext(ticketId: string): TicketContext | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`agentdocs:ticket:${ticketId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TicketContext;
  } catch {
    return null;
  }
}

const STATUS_OPTIONS: { value: TicketStatus; label: string; icon: typeof CircleDot; className: string }[] = [
  { value: "open", label: "Open", icon: CircleDot, className: "text-foreground" },
  { value: "in_progress", label: "In Progress", icon: ArrowUpCircle, className: "text-yellow-500" },
  { value: "closed", label: "Closed", icon: CheckCircle2, className: "text-muted-foreground/50" },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string; variant: "default" | "secondary" | "destructive" | "outline" }[] = [
  { value: "low", label: "Low", variant: "outline" },
  { value: "medium", label: "Medium", variant: "secondary" },
  { value: "high", label: "High", variant: "default" },
  { value: "urgent", label: "Urgent", variant: "destructive" },
];

export default function TicketPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  const { active } = useIdentity();
  const [ticketCtx, setTicketCtx] = useState<TicketContext | null>(null);
  const [status, setStatus] = useState<TicketStatus>("open");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  useEffect(() => {
    const ctx = getTicketContext(ticketId);
    setTicketCtx(ctx);
  }, [ticketId]);

  const {
    body,
    comments,
    loading,
    addComment,
    updateStatus,
    updatePriority,
  } = useTicketDetail(ticketId, ticketCtx?.ticketKey ?? null, active);

  const handleStatusChange = useCallback(
    async (newStatus: TicketStatus) => {
      setStatus(newStatus);
      try {
        await updateStatus(newStatus);
        toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
      } catch {
        toast.error("Failed to update status");
      }
    },
    [updateStatus],
  );

  const handlePriorityChange = useCallback(
    async (newPriority: TicketPriority) => {
      setPriority(newPriority);
      try {
        await updatePriority(newPriority);
        toast.success(`Priority updated to ${newPriority}`);
      } catch {
        toast.error("Failed to update priority");
      }
    },
    [updatePriority],
  );

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim() || addingComment) return;
    setAddingComment(true);
    try {
      await addComment(commentText.trim());
      setCommentText("");
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setAddingComment(false);
    }
  }, [commentText, addingComment, addComment]);

  if (!ticketCtx) {
    return (
      <div className="grain flex flex-col flex-1">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-sm px-6">
            <div className="h-12 w-12 mx-auto rounded-lg bg-muted/50 border border-border flex items-center justify-center">
              <Lock className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              Ticket key not found. Open this ticket from your tickets list.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/app")}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to Tickets
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grain flex flex-col flex-1">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => router.push("/app")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate max-w-[300px]">
                {ticketCtx.title}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:inline">
                e2ee
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {active && (
              <ShareTicketDialog
                ticketId={ticketId}
                ticketKey={ticketCtx.ticketKey}
                identity={active}
              />
            )}
          </div>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-6">
            {/* ── Status & Priority controls ────────────────────── */}
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                  Status
                </span>
                <div className="flex gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleStatusChange(opt.value)}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          status === opt.value
                            ? "border-foreground/40 bg-foreground/10"
                            : "border-border text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <Icon className={`h-3 w-3 ${opt.className}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                  Priority
                </span>
                <div className="flex gap-1.5">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handlePriorityChange(opt.value)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        priority === opt.value
                          ? "border-foreground/40 bg-foreground/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Ticket body ───────────────────────────────────── */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                Description
              </span>
              <div className="rounded-lg border bg-muted/20 p-4 min-h-[100px]">
                {body ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {body}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/40 italic">
                    No description
                  </p>
                )}
              </div>
            </div>

            {/* ── Comments ──────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                  Comments ({comments.length})
                </span>
              </div>

              {comments.length > 0 && (
                <div className="space-y-2">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border bg-muted/10 p-3 space-y-1.5"
                    >
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/50">
                        <User className="h-2.5 w-2.5" />
                        <span>{comment.authorId.slice(0, 8)}</span>
                        <span className="text-muted-foreground/20">&middot;</span>
                        <span>
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment */}
              <div className="flex gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleAddComment();
                    }
                  }}
                  placeholder="Add a comment... (Cmd+Enter to send)"
                  rows={2}
                  className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
                <Button
                  size="sm"
                  className="h-auto px-3 self-end"
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || addingComment}
                >
                  {addingComment ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t">
        <div className="mx-auto flex h-8 max-w-6xl items-center justify-between px-6">
          <span className="text-[10px] font-mono text-muted-foreground/40">
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/40">
            AES-256-GCM + Ed25519
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ── Share Ticket Dialog ─────────────────────────────────────────── */

function ShareTicketDialog({
  ticketId,
  ticketKey,
  identity,
}: {
  ticketId: string;
  ticketKey: string;
  identity: StoredIdentity;
}) {
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

      const grant = await cryptoCreateAccessGrant(
        ticketKey,
        identity.keyPair.encryption.privateKey,
        granteeInfo.identity.encryptionPublicKey,
      );

      await api(`/tickets/${ticketId}/share`, {
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
        err instanceof Error ? err.message : "Failed to share ticket",
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
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" />}
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg tracking-tight">
            Share Ticket
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Grant access to another identity. The ticket key will be encrypted
            using ECDH key agreement — only the recipient can decrypt it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label
              htmlFor="ticket-grantee-id"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Recipient Identity ID
            </Label>
            <Input
              id="ticket-grantee-id"
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
              <span>Access granted. The recipient can now decrypt this ticket.</span>
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
  );
}
