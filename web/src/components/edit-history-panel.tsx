"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronRight, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentEdit } from "@/hooks/use-documents";

interface EditHistoryPanelProps {
  edits: DocumentEdit[];
  isSpreadsheet?: boolean;
  onClose: () => void;
}

/** Simple line-level diff between two strings */
function computeDiff(
  oldText: string,
  newText: string,
): { type: "same" | "added" | "removed"; line: string }[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // LCS-based diff (Myers-like, simplified)
  const result: { type: "same" | "added" | "removed"; line: string }[] = [];

  // Build a simple LCS table
  const m = oldLines.length;
  const n = newLines.length;

  // For very large diffs, fall back to naive approach
  if (m * n > 100000) {
    for (const line of oldLines) result.push({ type: "removed", line });
    for (const line of newLines) result.push({ type: "added", line });
    return result;
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const diffLines: { type: "same" | "added" | "removed"; line: string }[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diffLines.unshift({ type: "same", line: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffLines.unshift({ type: "added", line: newLines[j - 1] });
      j--;
    } else {
      diffLines.unshift({ type: "removed", line: oldLines[i - 1] });
      i--;
    }
  }

  return diffLines;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function EditHistoryPanel({
  edits,
  isSpreadsheet,
  onClose,
}: EditHistoryPanelProps) {
  const [expandedEdit, setExpandedEdit] = useState<string | null>(null);

  // Edits are sorted by sequenceNumber ascending
  const reversedEdits = [...edits].reverse();

  return (
    <aside className="w-80 border-l bg-background/50 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Edit History
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Edit list */}
      <div className="flex-1 overflow-y-auto">
        {reversedEdits.map((edit, idx) => {
          const editIndex = edits.length - 1 - idx;
          const prevEdit = editIndex > 0 ? edits[editIndex - 1] : null;
          const isExpanded = expandedEdit === edit.id;
          const isFirst = editIndex === 0;

          return (
            <div key={edit.id} className="border-b border-border/50">
              {/* Edit summary row */}
              <button
                onClick={() =>
                  setExpandedEdit(isExpanded ? null : edit.id)
                }
                className="w-full flex items-start gap-2 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
              >
                <span className="mt-0.5 shrink-0 text-muted-foreground/50">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-medium text-foreground/80">
                      #{edit.sequenceNumber}
                    </span>
                    {isFirst && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50 bg-muted/50 px-1 rounded">
                        initial
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/50">
                    <span className="flex items-center gap-0.5">
                      <User className="h-2.5 w-2.5" />
                      {edit.authorId.slice(0, 8)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatTime(edit.createdAt)}
                    </span>
                  </div>
                  {!isSpreadsheet && !isExpanded && (
                    <p className="text-[10px] text-muted-foreground/40 truncate leading-tight">
                      <>
                        {edit.content.slice(0, 80)}
                        {edit.content.length > 80 ? "..." : ""}
                      </>
                    </p>
                  )}
                </div>
              </button>

              {/* Expanded diff view */}
              {isExpanded && (
                <div className="px-4 pb-3">
                  {isSpreadsheet ? (
                    <div className="text-[10px] font-mono text-muted-foreground/50 italic">
                      Spreadsheet diff not supported
                    </div>
                  ) : isFirst ? (
                    /* First edit: show full content as "added" */
                    <div className="rounded border bg-muted/10 overflow-auto max-h-64">
                      <pre className="text-[10px] font-mono leading-relaxed p-2">
                        {edit.content.split("\n").map((line, li) => (
                          <div
                            key={li}
                            className="text-foreground/60 px-1"
                          >
                            <span className="text-muted-foreground/30 select-none inline-block w-5 text-right mr-2">
                              {li + 1}
                            </span>
                            {line || " "}
                          </div>
                        ))}
                      </pre>
                    </div>
                  ) : prevEdit ? (
                    /* Subsequent edits: show diff */
                    <DiffView
                      oldText={prevEdit.content}
                      newText={edit.content}
                    />
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        {edits.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground/40">No edits yet</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2">
        <span className="text-[10px] font-mono text-muted-foreground/40">
          {edits.length} edit{edits.length !== 1 ? "s" : ""} total
        </span>
      </div>
    </aside>
  );
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const diffLines = computeDiff(oldText, newText);

  const stats = {
    added: diffLines.filter((d) => d.type === "added").length,
    removed: diffLines.filter((d) => d.type === "removed").length,
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] font-mono">
        {stats.added > 0 && (
          <span className="text-green-600 dark:text-green-400">+{stats.added}</span>
        )}
        {stats.removed > 0 && (
          <span className="text-red-600 dark:text-red-400">-{stats.removed}</span>
        )}
      </div>
      <div className="rounded border bg-muted/10 overflow-auto max-h-64">
        <pre className="text-[10px] font-mono leading-relaxed p-2">
          {diffLines.map((dl, i) => (
            <div
              key={i}
              className={
                dl.type === "added"
                  ? "bg-green-500/15 text-green-700 dark:text-green-300 px-1"
                  : dl.type === "removed"
                    ? "bg-red-500/15 text-red-700 dark:text-red-400 line-through px-1"
                    : "text-foreground/50 px-1"
              }
            >
              <span className="select-none inline-block w-3 mr-1 text-muted-foreground/30">
                {dl.type === "added" ? "+" : dl.type === "removed" ? "-" : " "}
              </span>
              {dl.line || " "}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
