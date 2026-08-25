import { formatTable } from "mdtableops";
import { SCHEMA_VERSION } from "./version.js";
import { estimateTokens, savedPct, utf8Bytes } from "./tokens.js";

export interface JsonEnvelope {
  schemaVersion: number;
  ok: boolean;
  data: unknown;
  diagnostics: { level: "info" | "warn" | "error"; message: string; file?: string; table?: string; column?: string; line?: number }[];
  more?: boolean;
  cursor?: string;
  estimates?: {
    originalTokens: number;
    returnedTokens: number;
    savedPct: number;
  };
}

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function renderJsonEnvelope(opts: {
  id: string;
  headingPath: string[];
  columns: string[];
  rows: string[][];
  more: boolean;
  cursor?: string;
  hash: string;
  originalTokens: number;
}): string {
  const data = {
    id: opts.id,
    headingPath: opts.headingPath,
    columns: opts.columns,
    rows: opts.rows,
    rowCount: opts.rows.length,
    sha256: opts.hash,
  };
  const build = (returnedTokens: number): JsonEnvelope => {
    const env: JsonEnvelope = {
      schemaVersion: SCHEMA_VERSION,
      ok: true,
      data,
      diagnostics: [],
      estimates: {
        originalTokens: opts.originalTokens,
        returnedTokens,
        savedPct: savedPct(opts.originalTokens, returnedTokens),
      },
    };
    if (opts.more) {
      env.more = true;
      if (opts.cursor) env.cursor = opts.cursor;
    } else {
      env.more = false;
    }
    return env;
  };
  let text = pretty(build(0));
  text = pretty(build(estimateTokens(utf8Bytes(text))));
  text = pretty(build(estimateTokens(utf8Bytes(text))));
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

export function renderJsonl(opts: {
  id: string;
  columns: string[];
  rows: string[][];
  more: boolean;
  cursor?: string;
}): string {
  const header: Record<string, unknown> = {
    _type: "mdtablepack-meta",
    v: 1,
    id: opts.id,
    n: opts.rows.length,
    more: opts.more,
  };
  if (opts.more && opts.cursor) header.cursor = opts.cursor;
  const lines = [JSON.stringify(header)];
  for (const row of opts.rows) {
    const obj: Record<string, string> = {};
    for (let i = 0; i < opts.columns.length; i++) {
      const col = opts.columns[i] ?? `col${i + 1}`;
      if (obj[col] === undefined) obj[col] = row[i] ?? "";
    }
    lines.push(JSON.stringify(obj));
  }
  return lines.join("\n");
}

function tsvCell(s: string): string {
  return s.replace(/\r\n/g, " ").replace(/[\t\r\n]/g, " ");
}

export function renderTsv(columns: string[], rows: string[][]): string {
  const header = columns.map(tsvCell).join("\t");
  const body = rows.map((r) => columns.map((_, i) => tsvCell(r[i] ?? "")).join("\t"));
  return [header, ...body].join("\n");
}

export function renderMarkdown(
  columns: string[],
  alignments: Array<"left" | "right" | "center" | "none">,
  rows: string[][],
): string {
  const lines = formatTable({
    columns,
    alignments,
    rows: rows.map((values) => ({ values })),
    outerPipes: true,
  });
  return lines.join("\n");
}

export function stderrMoreLine(more: boolean, cursor: string | undefined, n: number): string | undefined {
  if (!more || !cursor) return undefined;
  return `mdtablepack: more=true cursor=${cursor} n=${n}`;
}
