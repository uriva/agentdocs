"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useIdentity } from "@/hooks/use-identity";
import { useDocumentEdits } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Save,
  Clock,
  User,
  Lock,
  FileText,
  Table2,
} from "lucide-react";
import { ShareDialog } from "@/components/share-dialog";
import { SpreadsheetEditor } from "@/components/spreadsheet-editor";
import {
  type SpreadsheetData,
  emptySpreadsheet,
  serializeSpreadsheet,
  deserializeSpreadsheet,
} from "@/lib/spreadsheet";

interface DocContext {
  title: string;
  docKey: string;
  type?: string;
}

/** Doc key is passed via sessionStorage to avoid URL exposure */
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

  // Text document state
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Spreadsheet state
  const [sheetData, setSheetData] = useState<SpreadsheetData>(
    emptySpreadsheet(),
  );

  // Common state
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialized, setInitialized] = useState(false);

  const isSpreadsheet = docCtx?.type === "spreadsheet";

  useEffect(() => {
    const ctx = getDocContext(docId);
    setDocCtx(ctx);
  }, [docId]);

  const { edits, loading, addEdit } = useDocumentEdits(
    docId,
    docCtx?.docKey ?? null,
    active,
  );

  // Build current state from edits (last edit = latest state)
  useEffect(() => {
    if (initialized || edits.length === 0) return;
    const latest = edits[edits.length - 1];
    if (isSpreadsheet) {
      try {
        setSheetData(deserializeSpreadsheet(latest.content));
      } catch {
        setSheetData(emptySpreadsheet());
      }
    } else {
      setContent(latest.content);
    }
    setInitialized(true);
  }, [edits, isSpreadsheet, initialized]);

  // Mark initialized when edits load empty (new doc)
  useEffect(() => {
    if (!loading && edits.length === 0 && docCtx) {
      setInitialized(true);
    }
  }, [loading, edits.length, docCtx]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    const payload = isSpreadsheet
      ? serializeSpreadsheet(sheetData)
      : content;
    if (!isSpreadsheet && !payload.trim()) return;
    setSaving(true);
    try {
      await addEdit(payload);
      setLastSaved(new Date());
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [content, sheetData, saving, addEdit, isSpreadsheet]);

  // Ctrl+S / Cmd+S shortcut
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
      <div className="grain flex flex-col min-h-full">
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
              onClick={() => router.push("/")}
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
    <div className="grain flex flex-col min-h-full">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              {isSpreadsheet ? (
                <Table2 className="h-4 w-4 text-muted-foreground/60" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground/60" />
              )}
              <span className="text-sm font-medium truncate max-w-[300px]">
                {docCtx.title}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:inline">
                e2ee
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:flex items-center gap-1">
                <Clock className="h-3 w-3" />
                saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {active && (
              <ShareDialog
                documentId={docId}
                docKey={docCtx.docKey}
                identity={active}
              />
            )}
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
          </div>
        </div>
      </header>

      {/* ── Editor ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : isSpreadsheet ? (
          /* ── Spreadsheet editor ─────────────────────────────────── */
          <div className="flex-1 flex flex-col">
            {edits.length > 0 && (
              <div className="flex items-center gap-2 py-2 px-6 border-b">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">
                  {edits.length} edit{edits.length !== 1 ? "s" : ""}
                </span>
                <span className="text-muted-foreground/20">|</span>
                <span className="text-[10px] font-mono text-muted-foreground/50 flex items-center gap-1">
                  <User className="h-2.5 w-2.5" />
                  {edits[edits.length - 1]?.authorId?.slice(0, 8)}
                </span>
              </div>
            )}
            <SpreadsheetEditor data={sheetData} onChange={setSheetData} />
          </div>
        ) : (
          /* ── Text editor ────────────────────────────────────────── */
          <div className="flex-1 flex flex-col mx-auto w-full max-w-3xl px-6">
            {edits.length > 0 && (
              <div className="flex items-center gap-2 py-3 border-b">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">
                  {edits.length} edit{edits.length !== 1 ? "s" : ""}
                </span>
                <span className="text-muted-foreground/20">|</span>
                <span className="text-[10px] font-mono text-muted-foreground/50 flex items-center gap-1">
                  <User className="h-2.5 w-2.5" />
                  {edits[edits.length - 1]?.authorId?.slice(0, 8)}
                </span>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing... (Markdown supported)"
              className="flex-1 w-full resize-none bg-transparent py-6 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/30 font-[family-name:var(--font-body)]"
              spellCheck
            />
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────── */}
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
