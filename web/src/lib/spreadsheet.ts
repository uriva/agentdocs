// Spreadsheet data model and utilities
// Cells are stored as a flat map keyed by "A1"-style refs
// The entire spreadsheet state is serialized to JSON, encrypted, and stored as an edit

export interface CellData {
  /** Raw display value */
  v?: string;
  /** Formula string (starts with =) — future use */
  f?: string;
}

export interface SpreadsheetData {
  /** Cell map keyed by "A1"-style refs */
  cells: Record<string, CellData>;
  /** Optional per-column widths in px */
  colWidths?: Record<string, number>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_COL_COUNT = 26;
export const DEFAULT_ROW_COUNT = 100;
export const DEFAULT_COL_WIDTH = 120;
export const ROW_HEADER_WIDTH = 48;
export const CELL_HEIGHT = 32;

// ─── Cell ref helpers ────────────────────────────────────────────────────────

/** Column index (0-based) → letter(s): 0→A, 1→B, …, 25→Z, 26→AA */
export function colToLetter(col: number): string {
  let s = "";
  let c = col;
  while (c >= 0) {
    s = String.fromCharCode((c % 26) + 65) + s;
    c = Math.floor(c / 26) - 1;
  }
  return s;
}

/** Letter(s) → column index (0-based): A→0, B→1, Z→25, AA→26 */
export function letterToCol(letters: string): number {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

/** Build a cell ref string: (0, 0) → "A1" */
export function cellRef(col: number, row: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

/** Parse a cell ref string: "A1" → { col: 0, row: 0 } */
export function parseRef(ref: string): { col: number; row: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { col: 0, row: 0 };
  return { col: letterToCol(match[1]), row: parseInt(match[2], 10) - 1 };
}

// ─── Empty spreadsheet ──────────────────────────────────────────────────────

export function emptySpreadsheet(): SpreadsheetData {
  return { cells: {} };
}

/** Serialize spreadsheet state for storage (will be encrypted) */
export function serializeSpreadsheet(data: SpreadsheetData): string {
  return JSON.stringify(data);
}

/** Deserialize spreadsheet state from stored content */
export function deserializeSpreadsheet(content: string): SpreadsheetData {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.cells === "object") {
      return parsed as SpreadsheetData;
    }
  } catch {
    // Fall through
  }
  return emptySpreadsheet();
}

/** Get the display value for a cell */
export function getCellDisplay(data: SpreadsheetData, ref: string): string {
  return data.cells[ref]?.v ?? "";
}

/** Set a cell value, returning a new SpreadsheetData (immutable) */
export function setCell(
  data: SpreadsheetData,
  ref: string,
  value: string,
): SpreadsheetData {
  const next = { ...data, cells: { ...data.cells } };
  if (value === "") {
    delete next.cells[ref];
  } else {
    next.cells[ref] = { v: value };
  }
  return next;
}

/** Get the bounds of used cells: { maxCol, maxRow } */
export function getUsedBounds(data: SpreadsheetData): {
  maxCol: number;
  maxRow: number;
} {
  let maxCol = 0;
  let maxRow = 0;
  for (const ref of Object.keys(data.cells)) {
    const { col, row } = parseRef(ref);
    if (col > maxCol) maxCol = col;
    if (row > maxRow) maxRow = row;
  }
  return { maxCol, maxRow };
}
