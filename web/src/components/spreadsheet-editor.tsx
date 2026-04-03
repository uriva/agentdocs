"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type KeyboardEvent,
} from "react";
import {
  type SpreadsheetData,
  colToLetter,
  cellRef,
  getCellDisplay,
  setCell,
  DEFAULT_COL_COUNT,
  DEFAULT_ROW_COUNT,
  DEFAULT_COL_WIDTH,
  ROW_HEADER_WIDTH,
  CELL_HEIGHT,
} from "@/lib/spreadsheet";

interface SpreadsheetEditorProps {
  data: SpreadsheetData;
  onChange: (data: SpreadsheetData) => void;
}

interface Selection {
  col: number;
  row: number;
}

export function SpreadsheetEditor({ data, onChange }: SpreadsheetEditorProps) {
  const [selection, setSelection] = useState<Selection>({ col: 0, row: 0 });
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [colCount] = useState(DEFAULT_COL_COUNT);
  const [rowCount] = useState(DEFAULT_ROW_COUNT);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const selectedRef = cellRef(selection.col, selection.row);
  const selectedValue = getCellDisplay(data, selectedRef);

  // Focus the cell input when editing starts
  useEffect(() => {
    if (editing && cellInputRef.current) {
      cellInputRef.current.focus();
    }
  }, [editing]);

  // Scroll selected cell into view
  useEffect(() => {
    if (!gridRef.current) return;
    const cellEl = gridRef.current.querySelector(
      `[data-ref="${selectedRef}"]`,
    ) as HTMLElement | null;
    if (cellEl) {
      cellEl.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [selectedRef]);

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const ref = cellRef(selection.col, selection.row);
    if (editValue !== getCellDisplay(data, ref)) {
      onChange(setCell(data, ref, editValue));
    }
    setEditing(false);
  }, [editing, editValue, selection, data, onChange]);

  const startEditing = useCallback(
    (value?: string) => {
      setEditValue(value ?? getCellDisplay(data, selectedRef));
      setEditing(true);
    },
    [data, selectedRef],
  );

  const handleCellClick = useCallback(
    (col: number, row: number) => {
      if (editing) commitEdit();
      setSelection({ col, row });
    },
    [editing, commitEdit],
  );

  const handleCellDoubleClick = useCallback(
    (col: number, row: number) => {
      setSelection({ col, row });
      const ref = cellRef(col, row);
      setEditValue(getCellDisplay(data, ref));
      setEditing(true);
    },
    [data],
  );

  const handleGridKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (editing) {
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            commitEdit();
            setSelection((s) => ({
              ...s,
              row: Math.min(s.row + 1, rowCount - 1),
            }));
            break;
          case "Tab":
            e.preventDefault();
            commitEdit();
            if (e.shiftKey) {
              setSelection((s) => ({
                ...s,
                col: Math.max(s.col - 1, 0),
              }));
            } else {
              setSelection((s) => ({
                ...s,
                col: Math.min(s.col + 1, colCount - 1),
              }));
            }
            break;
          case "Escape":
            e.preventDefault();
            setEditing(false);
            break;
        }
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setSelection((s) => ({ ...s, row: Math.max(s.row - 1, 0) }));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelection((s) => ({
            ...s,
            row: Math.min(s.row + 1, rowCount - 1),
          }));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setSelection((s) => ({ ...s, col: Math.max(s.col - 1, 0) }));
          break;
        case "ArrowRight":
          e.preventDefault();
          setSelection((s) => ({
            ...s,
            col: Math.min(s.col + 1, colCount - 1),
          }));
          break;
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            setSelection((s) => ({ ...s, col: Math.max(s.col - 1, 0) }));
          } else {
            setSelection((s) => ({
              ...s,
              col: Math.min(s.col + 1, colCount - 1),
            }));
          }
          break;
        case "Enter":
          e.preventDefault();
          startEditing();
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          onChange(setCell(data, selectedRef, ""));
          break;
        case "F2":
          e.preventDefault();
          startEditing();
          break;
        default:
          // Start editing on any printable character
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            startEditing(e.key);
          }
      }
    },
    [
      editing,
      commitEdit,
      startEditing,
      onChange,
      data,
      selectedRef,
      colCount,
      rowCount,
    ],
  );

  const handleFormulaBarKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const ref = cellRef(selection.col, selection.row);
        if (editValue !== getCellDisplay(data, ref)) {
          onChange(setCell(data, ref, editValue));
        }
        setEditing(false);
        gridRef.current?.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
        gridRef.current?.focus();
      }
    },
    [selection, editValue, data, onChange],
  );

  const getColWidth = useCallback(
    (col: number) => {
      const letter = colToLetter(col);
      return data.colWidths?.[letter] ?? DEFAULT_COL_WIDTH;
    },
    [data.colWidths],
  );

  // Visible columns/rows for rendering
  const visibleCols = Array.from({ length: colCount }, (_, i) => i);
  const visibleRows = Array.from({ length: rowCount }, (_, i) => i);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Formula bar ──────────────────────────────────────────── */}
      <div className="flex items-center border-b h-9 shrink-0">
        <div
          className="flex items-center justify-center text-[10px] font-mono font-medium text-foreground/80 border-r bg-muted/30 shrink-0 h-full px-3 select-none"
          style={{ minWidth: 56 }}
        >
          {selectedRef}
        </div>
        <input
          ref={formulaInputRef}
          type="text"
          value={editing ? editValue : selectedValue}
          onChange={(e) => {
            if (!editing) startEditing(e.target.value);
            else setEditValue(e.target.value);
          }}
          onFocus={() => {
            if (!editing) startEditing();
          }}
          onKeyDown={handleFormulaBarKeyDown}
          className="flex-1 h-full bg-transparent px-2.5 text-xs font-mono outline-none placeholder:text-muted-foreground/30"
          placeholder="Enter value..."
          spellCheck={false}
        />
      </div>

      {/* ── Grid ─────────────────────────────────────────────────── */}
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        className="flex-1 overflow-auto outline-none relative"
        style={{ contain: "strict" }}
      >
        <div
          className="relative"
          style={{
            width:
              ROW_HEADER_WIDTH +
              visibleCols.reduce((sum, c) => sum + getColWidth(c), 0),
            height: CELL_HEIGHT + visibleRows.length * CELL_HEIGHT,
          }}
        >
          {/* ── Column headers ──────────────────────────────────── */}
          <div
            className="sticky top-0 z-20 flex"
            style={{ height: CELL_HEIGHT }}
          >
            {/* Corner cell */}
            <div
              className="sticky left-0 z-30 bg-muted/60 border-b border-r flex items-center justify-center"
              style={{
                width: ROW_HEADER_WIDTH,
                height: CELL_HEIGHT,
                minWidth: ROW_HEADER_WIDTH,
              }}
            />
            {visibleCols.map((col) => (
              <div
                key={col}
                className={`bg-muted/60 border-b border-r flex items-center justify-center text-[10px] font-mono font-medium select-none shrink-0 transition-colors ${
                  col === selection.col
                    ? "text-foreground bg-foreground/5"
                    : "text-muted-foreground/60"
                }`}
                style={{ width: getColWidth(col), height: CELL_HEIGHT }}
              >
                {colToLetter(col)}
              </div>
            ))}
          </div>

          {/* ── Rows ───────────────────────────────────────────── */}
          {visibleRows.map((row) => (
            <div key={row} className="flex" style={{ height: CELL_HEIGHT }}>
              {/* Row header */}
              <div
                className={`sticky left-0 z-10 bg-muted/60 border-b border-r flex items-center justify-center text-[10px] font-mono select-none shrink-0 transition-colors ${
                  row === selection.row
                    ? "text-foreground bg-foreground/5"
                    : "text-muted-foreground/60"
                }`}
                style={{
                  width: ROW_HEADER_WIDTH,
                  height: CELL_HEIGHT,
                  minWidth: ROW_HEADER_WIDTH,
                }}
              >
                {row + 1}
              </div>

              {/* Cells */}
              {visibleCols.map((col) => {
                const ref = cellRef(col, row);
                const isSelected =
                  col === selection.col && row === selection.row;
                const value = getCellDisplay(data, ref);

                return (
                  <div
                    key={col}
                    data-ref={ref}
                    onClick={() => handleCellClick(col, row)}
                    onDoubleClick={() => handleCellDoubleClick(col, row)}
                    className={`border-b border-r flex items-center shrink-0 relative transition-colors ${
                      isSelected
                        ? "ring-2 ring-foreground/60 ring-inset z-10 bg-foreground/[0.03]"
                        : "hover:bg-muted/20"
                    }`}
                    style={{ width: getColWidth(col), height: CELL_HEIGHT }}
                  >
                    {isSelected && editing ? (
                      <input
                        ref={cellInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        className="absolute inset-0 w-full h-full bg-background px-2 text-xs font-mono outline-none ring-2 ring-foreground z-20"
                        spellCheck={false}
                      />
                    ) : (
                      <span className="px-2 text-xs font-mono truncate w-full">
                        {value}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
