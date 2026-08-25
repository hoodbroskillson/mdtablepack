import {
  AppError,
  EXIT,
  findColumn,
  parseJsonObject,
  parseMarkdown,
  readFileBytes,
  selectTable,
} from "mdtableops";
import type { ColNum, ColSubstr } from "./argv.js";
import { fitRowCount } from "./budget.js";
import { renderCompact } from "./compact.js";
import { assertCursorHash, decodeCursor, encodeCursor } from "./cursor.js";
import { renderJsonEnvelope, renderJsonl, renderMarkdown, renderTsv } from "./format.js";
import { estimateTokens } from "./tokens.js";

export type TableLike = ReturnType<typeof parseMarkdown>["tables"][number];

export interface QueryOptions {
  table?: string;
  tableId?: string;
  select?: string[];
  whereJson?: string;
  gte: ColNum[];
  lte: ColNum[];
  gt: ColNum[];
  lt: ColNum[];
  contains: ColSubstr[];
  limit?: number;
  maxTokens?: number;
  maxBytes?: number;
  cursor?: string;
  format: "compact" | "json" | "jsonl" | "tsv" | "markdown";
}

export interface PackedQuery {
  id: string;
  headingPath: string[];
  hash: string;
  columns: string[];
  alignments: TableLike["alignments"];
  rows: string[][];
  n: number;
  more: boolean;
  cursor?: string;
  originalBytes: number;
  originalTokens: number;
  text: string;
}

function parseNumericCell(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function stringifyWhereValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function projectRow(values: string[], idxs: number[]): string[] {
  return idxs.map((i) => values[i] ?? "");
}

function matchesNumeric(cell: string, n: number, op: "gte" | "lte" | "gt" | "lt"): boolean {
  const v = parseNumericCell(cell);
  if (v === undefined) return false;
  switch (op) {
    case "gte":
      return v >= n;
    case "lte":
      return v <= n;
    case "gt":
      return v > n;
    case "lt":
      return v < n;
  }
}

export function prepareRows(
  table: TableLike,
  file: string,
  opts: QueryOptions,
): {
  columns: string[];
  alignments: TableLike["alignments"];
  filtered: string[][];
  start: number;
} {
  const details = { file, table: table.id };
  const colIdxs = opts.select
    ? opts.select.map((name) => findColumn(table.columns, name, details))
    : table.columns.map((_, i) => i);
  const columns = colIdxs.map((i) => table.columns[i] ?? `col${i + 1}`);
  const alignments = colIdxs.map((i) => table.alignments[i] ?? "none");

  const whereObj = opts.whereJson ? parseJsonObject(opts.whereJson, "--where-json") : undefined;
  const where: { index: number; value: string }[] = [];
  if (whereObj) {
    for (const key of Object.keys(whereObj)) {
      const idx = findColumn(table.columns, key, details);
      where.push({ index: idx, value: stringifyWhereValue(whereObj[key]) });
    }
  }

  const resolveNum = (f: ColNum) => ({
    index: findColumn(table.columns, f.col, details),
    n: f.n,
  });
  const gte = opts.gte.map(resolveNum);
  const lte = opts.lte.map(resolveNum);
  const gt = opts.gt.map(resolveNum);
  const lt = opts.lt.map(resolveNum);
  const contains = opts.contains.map((f) => ({
    index: findColumn(table.columns, f.col, details),
    substr: f.substr.toLowerCase(),
  }));

  const filtered: string[][] = [];
  for (const row of table.rows) {
    const values = row.values;
    if (where.length && !where.every((w) => (values[w.index] ?? "") === w.value)) continue;
    if (gte.length && !gte.every((f) => matchesNumeric(values[f.index] ?? "", f.n, "gte"))) continue;
    if (lte.length && !lte.every((f) => matchesNumeric(values[f.index] ?? "", f.n, "lte"))) continue;
    if (gt.length && !gt.every((f) => matchesNumeric(values[f.index] ?? "", f.n, "gt"))) continue;
    if (lt.length && !lt.every((f) => matchesNumeric(values[f.index] ?? "", f.n, "lt"))) continue;
    if (contains.length && !contains.every((f) => (values[f.index] ?? "").toLowerCase().includes(f.substr))) {
      continue;
    }
    filtered.push(projectRow(values, colIdxs));
  }

  let start = 0;
  if (opts.cursor) {
    const payload = decodeCursor(opts.cursor);
    assertCursorHash(payload, table.sha256, file, table.id);
    start = payload.offset;
    if (start > filtered.length) start = filtered.length;
  }

  return { columns, alignments, filtered, start };
}

function pageSlice(filtered: string[][], start: number, limit: number | undefined): string[][] {
  const rest = filtered.slice(start);
  if (limit === undefined) return rest;
  return rest.slice(0, limit);
}

function cursorFor(more: boolean, hash: string, nextOffset: number): string | undefined {
  return more ? encodeCursor(hash, nextOffset) : undefined;
}

export function packQuery(table: TableLike, file: string, opts: QueryOptions): PackedQuery {
  const { columns, alignments, filtered, start } = prepareRows(table, file, opts);
  const page = pageSlice(filtered, start, opts.limit);
  const originalBytes = table.source.length;
  const originalTokens = estimateTokens(originalBytes);
  const total = filtered.length;
  const hash = table.sha256;
  const id = table.id;

  const render = (n: number, more: boolean, nextOffset: number): string => {
    const rows = page.slice(0, n);
    switch (opts.format) {
      case "compact":
        return renderCompact({ id, columns, rows, more, hash, nextOffset });
      case "json":
        return renderJsonEnvelope({
          id,
          headingPath: table.headingPath,
          columns,
          rows,
          more,
          cursor: cursorFor(more, hash, nextOffset),
          hash,
          originalTokens,
        });
      case "jsonl":
        return renderJsonl({
          id,
          columns,
          rows,
          more,
          cursor: cursorFor(more, hash, nextOffset),
        });
      case "tsv":
        return renderTsv(columns, rows);
      case "markdown":
        return renderMarkdown(columns, alignments, rows);
    }
  };

  const n = fitRowCount(page.length, start, total, render, opts.maxTokens, opts.maxBytes);
  const nextOffset = start + n;
  const more = nextOffset < total;
  const rows = page.slice(0, n);
  const text = render(n, more, nextOffset);
  return {
    id,
    headingPath: table.headingPath,
    hash,
    columns,
    alignments,
    rows,
    n,
    more,
    cursor: cursorFor(more, hash, nextOffset),
    originalBytes,
    originalTokens,
    text,
  };
}

export async function queryFile(fileArg: string, followSymlinks: boolean, opts: QueryOptions): Promise<PackedQuery> {
  const { path: filePath, bytes } = await readFileBytes(fileArg, followSymlinks);
  const doc = parseMarkdown(bytes, filePath);
  if (!opts.table && !opts.tableId) {
    throw new AppError("select a table with --table NAME or --table-id ID", EXIT.usage, { file: filePath });
  }
  const table = selectTable(doc, { table: opts.table, tableId: opts.tableId });
  return packQuery(table, filePath, opts);
}
