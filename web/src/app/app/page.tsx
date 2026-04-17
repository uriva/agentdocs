"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useIdentity } from "@/hooks/use-identity";
import { useDocuments, type DocumentHeader } from "@/hooks/use-documents";
import { IdentitySwitcher } from "@/components/identity-switcher";
import { CreateIdentityDialog } from "@/components/create-identity-dialog";
import { ImportIdentityDialog } from "@/components/import-identity-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Plus,
  Lock,
  Shield,
  RefreshCw,
  Copy,
  Table2,
  Download,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { importIdentity } from "@/lib/crypto";
import type { StoredIdentity } from "@/lib/identity-store";
import { useState, useEffect, useRef, useCallback } from "react";

export default function AppPage() {
  const { isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="grain flex flex-col flex-1">
        <div className="flex-1 flex items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <AppShell />;
}

function AppShell() {
  const { user, signOut } = useAuth();
  const { identities, active, loading, switchTo, create, importExisting } =
    useIdentity();
  const router = useRouter();

  const createWithUser = useCallback(
    (name: string) => create(name, user!.id),
    [create, user],
  );

  const {
    documents,
    loading: docsLoading,
    error: docsError,
    refresh: refreshDocs,
    createDocument,
  } = useDocuments(active);

  const fragmentHandled = useRef(false);

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
    <div className="grain flex flex-col flex-1">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-foreground flex items-center justify-center">
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
                onCreate={createWithUser}
                onImport={importExisting}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={() => {
                signOut();
                router.replace("/");
              }}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : !active ? (
          <OnboardingState onCreate={createWithUser} onImport={importExisting} />
        ) : (
          <DocumentsView
            active={active}
            documents={documents}
            docsLoading={docsLoading}
            docsError={docsError}
            onRefresh={refreshDocs}
            onCreateDocument={createDocument}
          />
        )}
      </main>
    </div>
  );
}

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
          <div className="h-12 w-12 rounded-lg bg-foreground/10 border border-foreground/20 flex items-center justify-center">
            <Shield className="h-6 w-6 text-foreground" />
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
      </div>
    </div>
  );
}

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
    kind?: "doc" | "spreadsheet",
  ) => Promise<string>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreate(kind: "doc" | "spreadsheet" = "doc") {
    setCreating(true);
    try {
      const title =
        kind === "doc" ? "Untitled Document" : "Untitled Spreadsheet";
      const docId = await onCreateDocument(title, kind);
      const doc = documents.find((d) => d.id === docId);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `agentdocs:doc:${docId}`,
          JSON.stringify({
            title,
            docKey: doc?.docKey || "",
            kind,
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
            kind: updated.kind,
          }),
        );
      }
      router.push(`/app/doc/${docId}`);
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
          kind: doc.kind,
        }),
      );
    }
    router.push(`/app/doc/${doc.id}`);
  }

  function copyId() {
    navigator.clipboard.writeText(active.id);
    toast.success("Identity ID copied");
  }

  return (
    <div className="flex-1 flex flex-col">
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

      {docsError && (
        <div className="mx-auto max-w-6xl px-6 py-3">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {docsError}
          </div>
        </div>
      )}

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
                <div className="h-8 w-8 rounded-md bg-muted/60 border border-border flex items-center justify-center shrink-0 group-hover:border-foreground/30 group-hover:bg-foreground/5 transition-colors">
                  {doc.kind === "spreadsheet" ? (
                    <Table2 className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground/70 transition-colors" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground/70 transition-colors" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/50">
                    {new Date(doc.createdAt).toLocaleDateString()} · {doc.kind}
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
