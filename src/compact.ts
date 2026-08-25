import { encodeCursor } from "./cursor.js";

export interface CompactTable {
  v: 1;
  id: string;
  c: string[];
  r: string[][];
  n: number;
  more: boolean;
  cursor?: string;
}

export function renderCompact(opts: {
  id: string;
  columns: string[];
  rows: string[][];
  more: boolean;
  hash: string;
  nextOffset: number;
}): string {
  const obj: CompactTable = {
    v: 1,
    id: opts.id,
    c: opts.columns,
    r: opts.rows,
    n: opts.rows.length,
    more: opts.more,
  };
  if (opts.more) {
    obj.cursor = encodeCursor(opts.hash, opts.nextOffset);
  }
  return JSON.stringify(obj);
}

export interface CompactCatalogEntry {
  file: string;
  id: string;
  h: string[];
  c: string[];
  n: number;
  hash: string;
  tok: number;
}

export function renderCompactCatalog(tables: CompactCatalogEntry[]): string {
  return JSON.stringify({ v: 1, tables });
}
