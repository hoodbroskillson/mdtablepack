import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError, EXIT, parseMarkdown, readFileBytes } from "mdtableops";
import { renderCompactCatalog, type CompactCatalogEntry } from "./compact.js";
import { estimateTokens } from "./tokens.js";
import { SCHEMA_VERSION } from "./version.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".tmp", ".hg", ".svn"]);

export interface CatalogTable {
  file: string;
  id: string;
  headingPath: string[];
  columns: string[];
  rowCount: number;
  sha256: string;
  estimatedTokens: number;
}

function isMarkdownName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

async function walkMarkdownFiles(root: string, followSymlinks: boolean, acc: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (err) {
    throw new AppError(`cannot read directory: ${root}: ${(err as Error).message}`, EXIT.error, { file: root });
  }
  const ordered = entries.slice().sort((a, b) => a.name.localeCompare(b.name));
  for (const ent of ordered) {
    const full = path.join(root, ent.name);
    if (ent.name.startsWith(".") && ent.name !== ".") continue;
    let isDir = ent.isDirectory();
    let isFile = ent.isFile();
    if (ent.isSymbolicLink()) {
      if (!followSymlinks) {
        continue;
      }
      try {
        const st = await fs.stat(full);
        isDir = st.isDirectory();
        isFile = st.isFile();
      } catch {
        continue;
      }
    }
    if (isDir) {
      if (SKIP_DIRS.has(ent.name)) continue;
      await walkMarkdownFiles(full, followSymlinks, acc);
      continue;
    }
    if (isFile && isMarkdownName(ent.name)) {
      acc.push(full);
    }
  }
}

export async function collectMarkdownPaths(rootPath: string, followSymlinks: boolean): Promise<{ files: string[]; label: (p: string) => string }> {
  let st;
  try {
    st = await fs.lstat(rootPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new AppError(`path not found: ${rootPath}`, EXIT.error, { file: rootPath });
    }
    throw new AppError(`cannot stat path: ${rootPath}: ${(err as Error).message}`, EXIT.error, { file: rootPath });
  }
  if (st.isSymbolicLink()) {
    if (!followSymlinks) {
      throw new AppError(
        `refusing to operate on symlink (pass --follow-symlinks to allow): ${rootPath}`,
        EXIT.symlink,
        { file: rootPath },
      );
    }
  }
  const resolvedStat = st.isSymbolicLink() ? await fs.stat(rootPath) : st;
  if (resolvedStat.isDirectory()) {
    const files: string[] = [];
    await walkMarkdownFiles(rootPath, followSymlinks, files);
    files.sort((a, b) => a.localeCompare(b));
    return {
      files,
      label: (p) => path.relative(rootPath, p) || p,
    };
  }
  if (resolvedStat.isFile()) {
    return { files: [rootPath], label: () => rootPath };
  }
  throw new AppError(`not a file or directory: ${rootPath}`, EXIT.error, { file: rootPath });
}

export async function catalogPath(rootPath: string, followSymlinks: boolean): Promise<CatalogTable[]> {
  const { files, label } = await collectMarkdownPaths(rootPath, followSymlinks);
  const out: CatalogTable[] = [];
  for (const file of files) {
    const { path: filePath, bytes } = await readFileBytes(file, followSymlinks);
    const doc = parseMarkdown(bytes, filePath);
    for (const table of doc.tables) {
      out.push({
        file: label(file),
        id: table.id,
        headingPath: table.headingPath,
        columns: table.columns,
        rowCount: table.rows.length,
        sha256: table.sha256,
        estimatedTokens: estimateTokens(table.source.length),
      });
    }
  }
  return out;
}

export function renderCatalogCompact(tables: CatalogTable[]): string {
  const entries: CompactCatalogEntry[] = tables.map((t) => ({
    file: t.file,
    id: t.id,
    h: t.headingPath,
    c: t.columns,
    n: t.rowCount,
    hash: t.sha256,
    tok: t.estimatedTokens,
  }));
  return renderCompactCatalog(entries);
}

export function renderCatalogJson(tables: CatalogTable[]): string {
  return JSON.stringify(
    {
      schemaVersion: SCHEMA_VERSION,
      ok: true,
      data: { tables },
      diagnostics: [],
    },
    null,
    2,
  );
}
