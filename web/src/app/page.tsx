"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useIdentity } from "@/hooks/use-identity";
import { useDocuments, type DocumentHeader } from "@/hooks/use-documents";
import {
  useTickets,
  type TicketHeader,
  type TicketPriority,
} from "@/hooks/use-tickets";
import { IdentitySwitcher } from "@/components/identity-switcher";
import { CreateIdentityDialog } from "@/components/create-identity-dialog";
import { ImportIdentityDialog } from "@/components/import-identity-dialog";
import { CreateTicketDialog } from "@/components/create-ticket-dialog";
import { AuthGate } from "@/components/auth-gate";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Lock,
  Shield,
  RefreshCw,
  Copy,
  Table2,
  Download,
  Ticket,
  CircleDot,
  ArrowUpCircle,
  CheckCircle2,
  Terminal,
  Bot,
  KeyRound,
  EyeOff,
  ArrowRight,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { importIdentity } from "@/lib/crypto";
import type { StoredIdentity } from "@/lib/identity-store";
import { useState, useEffect, useRef } from "react";

type Tab = "documents" | "tickets";

export default function Home() {
  const { isLoading: authLoading, user } = useAuth();

  if (authLoading) {
    return (
      <div className="grain flex flex-col min-h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}

/* ── Landing Page ──────────────────────────────────────────────────── */

function LandingPage() {
  return (
    <div className="grain flex flex-col min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-terminal/90 flex items-center justify-center">
                <Lock className="h-3 w-3 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight">
                agentdocs
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignInButton />
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 pt-24 pb-20">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-mono text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-terminal animate-pulse" />
              API-first &middot; End-to-end encrypted
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Google Docs,
              <br />
              but for agents
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
              Documents, spreadsheets, and tickets your AI agents can read and
              write through a simple API. Every byte is end-to-end encrypted
              &mdash; we literally cannot read your data.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <SignInButton size="lg" />
              <a
                href="https://github.com/uriva/agentdocs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View source
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Code example */}
          <div className="mt-16 rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50 ml-2">
                agent.py
              </span>
            </div>
            <pre className="p-5 text-[13px] font-mono leading-relaxed overflow-x-auto">
              <code>
                <span className="text-muted-foreground"># Create a document with your agent&apos;s identity</span>
{"\n"}
                <span className="text-terminal">response</span>
                <span className="text-muted-foreground"> = </span>
                requests.post(<span className="text-orange-400 dark:text-orange-300">&quot;/api/documents&quot;</span>, headers=signed_headers, json={"{"}
{"\n"}
                {"    "}<span className="text-orange-400 dark:text-orange-300">&quot;encryptedTitle&quot;</span>: encrypt(title, doc_key),
{"\n"}
                {"    "}<span className="text-orange-400 dark:text-orange-300">&quot;type&quot;</span>: <span className="text-orange-400 dark:text-orange-300">&quot;doc&quot;</span>
{"\n"}
                {"}"})
{"\n\n"}
                <span className="text-muted-foreground"># Share it with another agent or human</span>
{"\n"}
                requests.post(<span className="text-orange-400 dark:text-orange-300">&quot;/api/documents/{"{"}doc_id{"}"}/share&quot;</span>, headers=signed_headers, json={"{"}
{"\n"}
                {"    "}<span className="text-orange-400 dark:text-orange-300">&quot;granteeId&quot;</span>: other_agent_id,
{"\n"}
                {"    "}<span className="text-orange-400 dark:text-orange-300">&quot;encryptedSymmetricKey&quot;</span>: ecdh_wrap(doc_key, their_public_key)
{"\n"}
                {"}"})
              </code>
            </pre>
          </div>
        </section>

        {/* Features */}
        <section className="border-t">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="grid sm:grid-cols-3 gap-10">
              <Feature
                icon={Bot}
                title="Built for agents"
                description="Every operation is an API call. No browser needed. Sign requests with your agent's Ed25519 private key and go."
              />
              <Feature
                icon={KeyRound}
                title="Unlimited identities"
                description="Create as many identities as you want for your army of bots. Each gets its own key pair. Share documents between them with ECDH key exchange."
              />
              <Feature
                icon={EyeOff}
                title="Zero-knowledge"
                description="AES-256-GCM encryption happens client-side. We store ciphertext. No plaintext titles, no plaintext content, no plaintext comments. Ever."
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2 className="text-2xl font-semibold tracking-tight mb-10">
              How it works
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-16 gap-y-8">
              <Step
                number="01"
                title="Generate an identity"
                description="An Ed25519 signing key + X25519 encryption key are generated in your browser. The private keys never leave your device."
              />
              <Step
                number="02"
                title="Create documents via API"
                description="POST encrypted content to the API. Agents sign each request with their private key. We verify and store ciphertext."
              />
              <Step
                number="03"
                title="Share with key exchange"
                description="Grant access by wrapping the document's AES key with ECDH. The recipient unwraps with their private key. We never see the plaintext key."
              />
              <Step
                number="04"
                title="Collaborate across identities"
                description="Humans use the web app. Agents use the API. Same encrypted documents, same access model. Mix and match."
              />
            </div>
          </div>
        </section>

        {/* Crypto details */}
        <section className="border-t">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-mono text-muted-foreground/60">
              <span>Ed25519 signing</span>
              <span className="text-muted-foreground/20">|</span>
              <span>X25519 ECDH</span>
              <span className="text-muted-foreground/20">|</span>
              <span>AES-256-GCM</span>
              <span className="text-muted-foreground/20">|</span>
              <span>HKDF-SHA256</span>
              <span className="text-muted-foreground/20">|</span>
              <span>Web Crypto API</span>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <h2 className="text-2xl font-semibold tracking-tight mb-3">
              Give your agents a workspace
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Open source. Self-hostable. Takes 30 seconds to create your first
              identity.
            </p>
            <SignInButton size="lg" />
          </div>
        </section>
      </main>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <div className="h-9 w-9 rounded-lg bg-terminal/10 border border-terminal/20 flex items-center justify-center">
        <Icon className="h-4 w-4 text-terminal" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="text-[11px] font-mono text-terminal/60 pt-0.5 shrink-0">
        {number}
      </span>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

function SignInButton({ size = "default" }: { size?: "default" | "lg" }) {
  const { sendMagicCode, signInWithMagicCode } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await sendMagicCode(email.trim());
      setStep("code");
      toast.success("Check your email for a sign-in code");
    } catch {
      toast.error("Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      await signInWithMagicCode(email.trim(), code.trim());
    } catch {
      toast.error("Invalid code");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        size={size === "lg" ? "lg" : "default"}
        className={size === "lg" ? "h-11 px-6 gap-2" : "h-8 px-3 gap-1.5 text-xs"}
        onClick={() => setOpen(true)}
      >
        Get Started
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {step === "email" ? (
        <>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
            autoFocus
            className="h-8 w-52 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
          />
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleSendCode}
            disabled={!email.trim() || loading}
          >
            {loading ? "..." : "Send Code"}
          </Button>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
            autoFocus
            className="h-8 w-28 rounded-lg border bg-background px-2.5 text-xs font-mono text-center tracking-widest outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
          />
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleVerifyCode}
            disabled={!code.trim() || loading}
          >
            {loading ? "..." : "Verify"}
          </Button>
          <button
            onClick={() => {
              setStep("email");
              setCode("");
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            back
          </button>
        </>
      )}
    </div>
  );
}

/* ── App Shell (authenticated) ─────────────────────────────────────── */

function AppShell() {
  const { user, signOut } = useAuth();
  const { identities, active, loading, switchTo, create, importExisting } =
    useIdentity();
  const {
    documents,
    loading: docsLoading,
    error: docsError,
    refresh: refreshDocs,
    createDocument,
  } = useDocuments(active);
  const {
    tickets,
    loading: ticketsLoading,
    error: ticketsError,
    refresh: refreshTickets,
    createTicket,
  } = useTickets(active);
  const fragmentHandled = useRef(false);
  const [tab, setTab] = useState<Tab>("documents");

  // ── Handle #import/ URL fragment on load ──────────────────────
  useEffect(() => {
    if (loading || fragmentHandled.current) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#import/")) return;
    fragmentHandled.current = true;

    const exportData = hash.slice("#import/".length);
    window.history.replaceState(null, "", window.location.pathname);

    importIdentity(exportData)
      .then((result) => {
        importExisting(result);
        toast.success(`Imported identity "${result.name}"`);
      })
      .catch(() => {
        toast.error("Failed to import identity from link");
      });
  }, [loading, importExisting]);

  return (
    <div className="grain flex flex-col min-h-full">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-terminal/90 flex items-center justify-center">
                <Lock className="h-3 w-3 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight">
                agentdocs
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/60 hidden sm:inline">
              e2ee
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!loading && (
              <IdentitySwitcher
                identities={identities}
                active={active}
                onSwitch={switchTo}
                onCreate={create}
                onImport={importExisting}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={() => signOut()}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {loading ? (
          <LoadingSkeleton />
        ) : !active ? (
          <OnboardingState onCreate={create} onImport={importExisting} />
        ) : (
          <>
            {/* ── Tabs ───────────────────────────────────────────── */}
            <div className="border-b">
              <div className="mx-auto max-w-6xl px-6">
                <div className="flex gap-0">
                  <button
                    onClick={() => setTab("documents")}
                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      tab === "documents"
                        ? "border-terminal text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Documents
                    {documents.length > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground/60 ml-0.5">
                        {documents.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setTab("tickets")}
                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      tab === "tickets"
                        ? "border-terminal text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Ticket className="h-3.5 w-3.5" />
                    Tickets
                    {tickets.length > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground/60 ml-0.5">
                        {tickets.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {tab === "documents" ? (
              <DocumentsView
                active={active}
                documents={documents}
                docsLoading={docsLoading}
                docsError={docsError}
                onRefresh={refreshDocs}
                onCreateDocument={createDocument}
              />
            ) : (
              <TicketsView
                active={active}
                tickets={tickets}
                ticketsLoading={ticketsLoading}
                ticketsError={ticketsError}
                onRefresh={refreshTickets}
                onCreateTicket={createTicket}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ── Loading skeleton ────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
  );
}

/* ── First-run: signed in but no identity yet ────────────────────── */

function OnboardingState({
  onCreate,
  onImport,
}: {
  onCreate: (name: string) => Promise<StoredIdentity>;
  onImport: (data: {
    id: string;
    name: string;
    keyPair: Awaited<ReturnType<typeof importIdentity>>["keyPair"];
  }) => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex items-center justify-center gap-1">
          <div className="h-12 w-12 rounded-lg bg-terminal/10 border border-terminal/20 flex items-center justify-center">
            <Shield className="h-6 w-6 text-terminal" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your first identity
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            agentdocs uses cryptographic identities instead of passwords. Your
            private key is generated in the browser and never leaves this
            device.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <CreateIdentityDialog
            onCreateIdentity={onCreate}
            trigger={
              <Button size="lg" className="h-11 px-6 gap-2">
                <Plus className="h-4 w-4" />
                Generate Identity
              </Button>
            }
          />
          <ImportIdentityDialog
            onImport={onImport}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Import existing identity
              </Button>
            }
          />
        </div>

        <div className="pt-4 flex items-center justify-center gap-6 text-[11px] font-mono text-muted-foreground/50">
          <span>Ed25519 signing</span>
          <span className="text-muted-foreground/20">|</span>
          <span>X25519 exchange</span>
          <span className="text-muted-foreground/20">|</span>
          <span>AES-256-GCM</span>
        </div>
      </div>
    </div>
  );
}

/* ── Documents view ──────────────────────────────────────────────── */

function DocumentsView({
  active,
  documents,
  docsLoading,
  docsError,
  onRefresh,
  onCreateDocument,
}: {
  active: StoredIdentity;
  documents: DocumentHeader[];
  docsLoading: boolean;
  docsError: string | null;
  onRefresh: () => Promise<void>;
  onCreateDocument: (
    title: string,
    type?: "doc" | "spreadsheet",
  ) => Promise<string>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreate(type: "doc" | "spreadsheet" = "doc") {
    setCreating(true);
    try {
      const title =
        type === "doc" ? "Untitled Document" : "Untitled Spreadsheet";
      const docId = await onCreateDocument(title, type);
      const doc = documents.find((d) => d.id === docId);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `agentdocs:doc:${docId}`,
          JSON.stringify({
            title,
            docKey: doc?.docKey || "",
            type,
          }),
        );
      }
      await onRefresh();
      const updated = documents.find((d) => d.id === docId);
      if (updated) {
        sessionStorage.setItem(
          `agentdocs:doc:${docId}`,
          JSON.stringify({
            title: updated.title,
            docKey: updated.docKey,
            type: updated.type,
          }),
        );
      }
      router.push(`/doc/${docId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create document",
      );
    } finally {
      setCreating(false);
    }
  }

  function openDoc(doc: DocumentHeader) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        `agentdocs:doc:${doc.id}`,
        JSON.stringify({
          title: doc.title,
          docKey: doc.docKey,
          type: doc.type,
        }),
      );
    }
    router.push(`/doc/${doc.id}`);
  }

  function copyId() {
    navigator.clipboard.writeText(active.id);
    toast.success("Identity ID copied");
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="border-b">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Documents
            </h2>
            {docsLoading && (
              <div className="h-3 w-3 animate-spin rounded-full border border-muted-foreground/30 border-t-transparent" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={() => copyId()}
              title="Copy identity ID"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={onRefresh}
              title="Refresh documents"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => handleCreate("doc")}
              disabled={creating}
            >
              <Plus className="h-3.5 w-3.5" />
              New Doc
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => handleCreate("spreadsheet")}
              disabled={creating}
            >
              <Table2 className="h-3.5 w-3.5" />
              New Sheet
            </Button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {docsError && (
        <div className="mx-auto max-w-6xl px-6 py-3">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {docsError}
          </div>
        </div>
      )}

      {/* Document list or empty state */}
      {documents.length === 0 && !docsLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-lg bg-muted/50 border border-border flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-muted-foreground">
                No documents yet
              </p>
              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                Create your first encrypted document or have someone share one
                with you.
              </p>
            </div>
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 rounded-md bg-muted/40 border border-border px-3 py-2 text-[11px] font-mono text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-terminal/70" />
                Signed in as{" "}
                <span className="text-foreground/80">{active.name}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-6xl px-6 py-4">
          <div className="space-y-1">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => openDoc(doc)}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50 group"
              >
                <div className="h-8 w-8 rounded-md bg-muted/60 border border-border flex items-center justify-center shrink-0 group-hover:border-terminal/30 group-hover:bg-terminal/5 transition-colors">
                  {doc.type === "spreadsheet" ? (
                    <Table2 className="h-4 w-4 text-muted-foreground/60 group-hover:text-terminal/70 transition-colors" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground/60 group-hover:text-terminal/70 transition-colors" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/50">
                    {new Date(doc.createdAt).toLocaleDateString()} · {doc.type}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/30 shrink-0">
                  {doc.id.slice(0, 8)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tickets view ────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  string,
  { icon: typeof CircleDot; label: string; className: string }
> = {
  open: { icon: CircleDot, label: "Open", className: "text-terminal" },
  in_progress: {
    icon: ArrowUpCircle,
    label: "In Progress",
    className: "text-yellow-500",
  },
  closed: {
    icon: CheckCircle2,
    label: "Closed",
    className: "text-muted-foreground/50",
  },
};

const PRIORITY_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  low: { label: "Low", variant: "outline" },
  medium: { label: "Medium", variant: "secondary" },
  high: { label: "High", variant: "default" },
  urgent: { label: "Urgent", variant: "destructive" },
};

function TicketsView({
  active,
  tickets,
  ticketsLoading,
  ticketsError,
  onRefresh,
  onCreateTicket,
}: {
  active: StoredIdentity;
  tickets: TicketHeader[];
  ticketsLoading: boolean;
  ticketsError: string | null;
  onRefresh: () => Promise<void>;
  onCreateTicket: (
    title: string,
    body: string,
    priority: TicketPriority,
  ) => Promise<string>;
}) {
  const router = useRouter();

  function openTicket(ticket: TicketHeader) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        `agentdocs:ticket:${ticket.id}`,
        JSON.stringify({
          title: ticket.title,
          ticketKey: ticket.ticketKey,
        }),
      );
    }
    router.push(`/ticket/${ticket.id}`);
  }

  async function handleCreate(
    title: string,
    body: string,
    priority: TicketPriority,
  ) {
    const ticketId = await onCreateTicket(title, body, priority);
    await onRefresh();
    const created = tickets.find((t) => t.id === ticketId);
    if (created) {
      sessionStorage.setItem(
        `agentdocs:ticket:${ticketId}`,
        JSON.stringify({
          title: created.title,
          ticketKey: created.ticketKey,
        }),
      );
    }
    router.push(`/ticket/${ticketId}`);
    return ticketId;
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="border-b">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tickets
            </h2>
            {ticketsLoading && (
              <div className="h-3 w-3 animate-spin rounded-full border border-muted-foreground/30 border-t-transparent" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={onRefresh}
              title="Refresh tickets"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <CreateTicketDialog
              onCreateTicket={handleCreate}
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Ticket
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {ticketsError && (
        <div className="mx-auto max-w-6xl px-6 py-3">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {ticketsError}
          </div>
        </div>
      )}

      {/* Ticket list or empty state */}
      {tickets.length === 0 && !ticketsLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-lg bg-muted/50 border border-border flex items-center justify-center">
              <Ticket className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-muted-foreground">
                No tickets yet
              </p>
              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                Create your first encrypted ticket or have someone share one
                with you.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-6xl px-6 py-4">
          <div className="space-y-1">
            {tickets.map((ticket) => {
              const status =
                STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
              const priority =
                PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
              const StatusIcon = status.icon;

              return (
                <button
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50 group"
                >
                  <StatusIcon
                    className={`h-4 w-4 shrink-0 ${status.className}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {ticket.title}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/50">
                      {new Date(ticket.createdAt).toLocaleDateString()} ·{" "}
                      {status.label}
                    </p>
                  </div>
                  <Badge
                    variant={priority.variant}
                    className="shrink-0 text-[10px]"
                  >
                    {priority.label}
                  </Badge>
                  <div className="text-[10px] font-mono text-muted-foreground/30 shrink-0">
                    {ticket.id.slice(0, 8)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
