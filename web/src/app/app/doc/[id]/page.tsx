"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useIdentity } from "@/hooks/use-identity";
import { useDocumentEdits } from "@/hooks/use-documents";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Save,
  Clock,
  Lock,
  FileText,
  Table2,
  History,
  Eye,
  Pencil,
} from "lucide-react";
import { ShareDialog } from "@/components/share-dialog";
import { SpreadsheetEditor } from "@/components/spreadsheet-editor";
import {
  type SpreadsheetData,
  emptySpreadsheet,
  deserializeSpreadsheet,
} from "@/lib/spreadsheet";
import { EditHistoryPanel } from "@/components/edit-history-panel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocContext {
  title: string;
  docKey: string;
  kind?: string;
}

function getDocContext(docId: string): DocContext | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`agentdocs:doc:${docId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DocContext;
  } catch {
    return null;
  }
}

export default function DocPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;
  const { active } = useIdentity();
  const [docCtx, setDocCtx] = useState<DocContext | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<"edit" | "view">("view");

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [userContent, setUserContent] = useState("");
  const [userEdited, setUserEdited] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [userSheetData, setUserSheetData] = useState<SpreadsheetData | null>(
    null,
  );

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    const ctx = getDocContext(docId);
    setDocCtx(ctx);
  }, [docId]);

  const { edits, loading, loaded, addEdit } = useDocumentEdits(
    docId,
    docCtx?.docKey ?? null,
    active,
  );

  const latest = useMemo(() => {
    if (!loaded || edits.length === 0) return null;
    return edits[edits.length - 1];
  }, [edits, loaded]);

  const docKind = latest?.kind ?? docCtx?.kind ?? "doc";
  const isSpreadsheet = docKind === "spreadsheet";

  const initialTitle = latest?.title ?? docCtx?.title ?? "Untitled Document";
  const initialContent = useMemo(() => {
    if (!latest || isSpreadsheet) return "";
    return latest.content;
  }, [latest, isSpreadsheet]);

  const initialSheetData = useMemo(() => {
    if (!isSpreadsheet) return emptySpreadsheet();
    if (!latest) return emptySpreadsheet();
    return deserializeSpreadsheet(latest.content);
  }, [isSpreadsheet, latest]);

  const content = userEdited ? userContent : initialContent;
  const sheetData = userSheetData ?? initialSheetData;

  useEffect(() => {
    if (!docCtx) return;
    if (docCtx.title !== initialTitle || docCtx.kind !== docKind) {
      const next = { ...docCtx, title: initialTitle, kind: docKind };
      setDocCtx(next);
      sessionStorage.setItem(`agentdocs:doc:${docId}`, JSON.stringify(next));
    }
  }, [docCtx, initialTitle, docKind, docId]);

  const handleContentChange = useCallback((value: string) => {
    setUserContent(value);
    setUserEdited(true);
  }, []);

  const handleSheetChange = useCallback((data: SpreadsheetData) => {
    setUserSheetData(data);
  }, []);

  const handleSave = useCallback(async () => {
    if (saving || !docCtx) return;
    const title = (editingTitle ? titleDraft : docCtx.title).trim() ||
      "Untitled Document";
    const snapshot =
      isSpreadsheet
        ? JSON.stringify({ kind: "spreadsheet", title, data: sheetData })
        : JSON.stringify({ kind: "doc", title, content });
    setSaving(true);
    try {
      await addEdit(snapshot);
      setLastSaved(new Date());
      setUserEdited(false);
      setUserSheetData(null);
      if (docCtx.title !== title) {
        const next = { ...docCtx, title };
        setDocCtx(next);
        sessionStorage.setItem(`agentdocs:doc:${docId}`, JSON.stringify(next));
      }
      if (editingTitle) setEditingTitle(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    docCtx,
    editingTitle,
    titleDraft,
    isSpreadsheet,
    sheetData,
    content,
    addEdit,
    docId,
  ]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  if (!docCtx) {
    return (
      <div className="grain flex flex-col flex-1">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-sm px-6">
            <div className="h-12 w-12 mx-auto rounded-lg bg-muted/50 border border-border flex items-center justify-center">
              <Lock className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              Document key not found. Open this document from your documents
              list.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/app")}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to Documents
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const canSave = isSpreadsheet || content.trim().length > 0;

  return (
    <div className="grain flex flex-col flex-1">
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
              {isSpreadsheet ? (
                <Table2 className="h-4 w-4 text-muted-foreground/60" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground/60" />
              )}
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditingTitle(false);
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setEditingTitle(false);
                    }
                  }}
                  onBlur={() => setEditingTitle(false)}
                  className="text-sm font-medium bg-transparent border-b border-foreground/30 outline-none max-w-[300px] px-0 py-0"
                  autoFocus
                />
              ) : (
                <span
                  className="text-sm font-medium truncate max-w-[300px] cursor-pointer hover:underline decoration-muted-foreground/30 underline-offset-2"
                  onClick={() => {
                    setTitleDraft(docCtx.title);
                    setEditingTitle(true);
                  }}
                  title="Click to rename"
                >
                  {docCtx.title}
                </span>
              )}
              <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:inline">
                e2ee
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isSpreadsheet && (
              <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5">
                <button
                  onClick={() => setMode("edit")}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    mode === "edit"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={() => setMode("view")}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    mode === "view"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  View
                </button>
              </div>
            )}

            {lastSaved && (
              <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:flex items-center gap-1">
                <Clock className="h-3 w-3" />
                saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {edits.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-3.5 w-3.5" />
                {edits.length} edit{edits.length !== 1 ? "s" : ""}
              </Button>
            )}
            {active && (
              <ShareDialog
                documentId={docId}
                docKey={docCtx.docKey}
                identity={active}
              />
            )}
            {mode === "edit" && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleSave}
                disabled={saving || !canSave}
              >
                {saving ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 overflow-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : isSpreadsheet ? (
            <div className="flex-1 flex flex-col">
              <SpreadsheetEditor data={sheetData} onChange={handleSheetChange} />
            </div>
          ) : mode === "edit" ? (
            <div className="flex-1 flex flex-col mx-auto w-full max-w-3xl px-6">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Start writing... (Markdown supported)"
                className="flex-1 w-full resize-none bg-transparent py-6 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/30 font-[family-name:var(--font-body)]"
                spellCheck
              />
            </div>
          ) : (
            <div className="flex-1 mx-auto w-full max-w-3xl px-6 py-6 overflow-auto">
              {content.trim() ? (
                <div className="prose-agentdocs">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/40 italic">
                  Nothing to preview — start writing in edit mode.
                </p>
              )}
            </div>
          )}
        </main>

        {showHistory && (
          <EditHistoryPanel
            edits={edits}
            isSpreadsheet={isSpreadsheet}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>

      <footer className="border-t">
        <div className="mx-auto flex h-8 max-w-6xl items-center justify-between px-6">
          <span className="text-[10px] font-mono text-muted-foreground/40">
            {isSpreadsheet
              ? `${Object.keys(sheetData.cells).length} cells`
              : `${content.length} chars`}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/40">
            AES-256-GCM + Ed25519
          </span>
        </div>
      </footer>
    </div>
  );
}
