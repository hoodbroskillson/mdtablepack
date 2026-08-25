import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const genDir = path.join(root, "benchmarks", "generated");
const tmpDir = path.join(os.tmpdir(), "mdtablepack-bench");

function estimateTokens(bytes: number): number {
  if (bytes <= 0) return 0;
  return Math.ceil(bytes / 4);
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length === 0) return 0;
  if (s.length % 2 === 0) return (s[mid - 1]! + s[mid]!) / 2;
  return s[mid]!;
}

export function generateTable(rows: number, cols: number): { table: string; file: string } {
  const headers = Array.from({ length: cols }, (_, i) => {
    if (i === 0) return "sku";
    if (i === 1) return "qty";
    if (i === 2) return "loc";
    return `c${i}`;
  });
  const tableLines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (let r = 0; r < rows; r++) {
    const cells = headers.map((_h, i) => {
      if (i === 0) return `A-${String(r).padStart(5, "0")}`;
      if (i === 1) return String(r % 100);
      if (i === 2) return r % 2 === 0 ? "us-east" : "eu-west";
      return `v${r}_${i}`;
    });
    tableLines.push(`| ${cells.join(" | ")} |`);
  }
  const heading = `# Bench ${rows}x${cols}\n\n`;
  const table = `${tableLines.join("\n")}\n`;
  return { table, file: heading + table };
}

function headingId(rows: number, cols: number): string {
  return `bench-${rows}x${cols}-1`;
}

interface Row {
  fixture: string;
  method: string;
  bytes: number;
  estTokens: number;
  medianMs: number;
  note: string;
}

function utf8(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function runsFor(rows: number): number {
  if (rows >= 10000) return 1;
  if (rows >= 1000) return 3;
  return 5;
}

function spawnTimed(
  argv: string[],
  runs: number,
): { medianMs: number; stdout: string; status: number; stderr: string } {
  const times: number[] = [];
  let stdout = "";
  let stderr = "";
  let status = 0;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const r = spawnSync(process.execPath, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    times.push(performance.now() - t0);
    stdout = r.stdout ?? "";
    stderr = r.stderr ?? "";
    status = r.status ?? 1;
  }
  return { medianMs: Math.round(median(times) * 100) / 100, stdout, status, stderr };
}

function pushResult(
  results: Row[],
  fixture: string,
  method: string,
  stdout: string,
  medianMs: number,
  note: string,
): void {
  const bytes = utf8(stdout);
  results.push({ fixture, method, bytes, estTokens: estimateTokens(bytes), medianMs, note });
}

function main(): void {
  mkdirSync(genDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
  const opsCli = path.join(root, "node_modules", "mdtableops", "dist", "cli.js");
  const packCli = path.join(root, "dist", "cli.js");
  if (!existsSync(packCli) || !existsSync(opsCli)) {
    console.error("build dist clis first");
    process.exit(1);
  }
  const results: Row[] = [];
  const sizeList: [number, number][] = [];
  for (const rows of [10, 100, 1000, 10000]) {
    for (const cols of [3, 6, 12]) sizeList.push([rows, cols]);
  }
  for (const pair of sizeList) {
    const rows = pair[0];
    const cols = pair[1];
    const generated = generateTable(rows, cols);
    const name = String(rows) + "x" + String(cols) + ".md";
    const dest = rows <= 100 ? path.join(genDir, name) : path.join(tmpDir, name);
    writeFileSync(dest, generated.file);
    const id = headingId(rows, cols);
    const nRuns = runsFor(rows);
    const rawBytes = utf8(generated.table);
    results.push({
      fixture: name,
      method: "markdown-raw",
      bytes: rawBytes,
      estTokens: estimateTokens(rawBytes),
      medianMs: 0,
      note: "table source bytes only (no heading); estimator ceil(utf8/4)",
    });
    const flags = { t: "--table-id", f: "--format" };
    const ops = spawnTimed([opsCli, "read", dest, flags.t, id, "--json"], nRuns);
    if (ops.status !== 0) console.error("ops failed for " + name + ": " + ops.stderr);
    pushResult(results, name, "mdtableops-read-json", ops.stdout, ops.medianMs, "spawn ops read json");
    const jsonl = spawnTimed([packCli, "query", dest, flags.t, id, flags.f, "jsonl"], nRuns);
    pushResult(results, name, "mdtablepack-jsonl", jsonl.stdout, jsonl.medianMs, "jsonl objects plus meta header");
    const compact = spawnTimed([packCli, "query", dest, flags.t, id, flags.f, "compact"], nRuns);
    pushResult(results, name, "mdtablepack-compact", compact.stdout, compact.medianMs, "default compact one-liner");
    const projected = spawnTimed([packCli, "query", dest, flags.t, id, flags.f, "compact", "--select", "sku,qty", "--contains", "loc=east"], nRuns);
    pushResult(results, name, "compact-select-filter", projected.stdout, projected.medianMs, "select sku,qty contains loc=east");
    const paged = spawnTimed([packCli, "query", dest, flags.t, id, flags.f, "compact", "--limit", "10"], nRuns);
    pushResult(results, name, "compact-limit-10", paged.stdout, paged.medianMs, "pagination first page limit 10");
    const budget = spawnTimed([packCli, "query", dest, flags.t, id, flags.f, "compact", "--max-tokens", "250"], nRuns);
    pushResult(results, name, "compact-max-tokens-250", budget.stdout, budget.medianMs, "budget packing max-tokens 250");
  }
  const lines: string[] = [];
  lines.push("# Benchmarks");
  lines.push("");
  lines.push("Measured on this machine. Token counts are **estimates**: `ceil(utf8_bytes / 4)`, not tiktoken and not a provider bill.");
  lines.push("");
  lines.push("Generated: " + new Date().toISOString());
  lines.push("Node: " + process.version + "  platform: " + process.platform + "/" + process.arch);
  lines.push("");
  lines.push("Fixtures: rows x cols GFM tables (sku, qty, loc, plus extra columns). 10 and 100 row files are committed under benchmarks/generated/. 1000 and 10000 row files are generated at bench time.");
  lines.push("");
  lines.push("| fixture | method | bytes | est. tokens | median ms | note |");
  lines.push("| --- | --- | ---: | ---: | ---: | --- |");
  for (const r of results) {
    lines.push("| " + r.fixture + " | " + r.method + " | " + String(r.bytes) + " | " + String(r.estTokens) + " | " + String(r.medianMs) + " | " + r.note + " |");
  }
  lines.push("");
  lines.push("## Headline (10x3 committed fixture)");
  const c10 = results.find((r) => r.fixture === "10x3.md" && r.method === "mdtablepack-compact");
  const m10 = results.find((r) => r.fixture === "10x3.md" && r.method === "markdown-raw");
  const j10 = results.find((r) => r.fixture === "10x3.md" && r.method === "mdtableops-read-json");
  if (c10 && m10 && j10) {
    const pct = m10.estTokens === 0 ? 0 : Math.round((1 - c10.estTokens / m10.estTokens) * 100);
    lines.push("");
    lines.push("10x3 table: raw markdown **" + m10.bytes + " bytes / " + m10.estTokens + " est. tokens**; mdtableops read json **" + j10.bytes + " bytes / " + j10.estTokens + " est. tokens** (" + j10.medianMs + " ms); mdtablepack compact **" + c10.bytes + " bytes / " + c10.estTokens + " est. tokens** (" + c10.medianMs + " ms). Compact vs raw markdown: **" + pct + "%** estimated token savings.");
  }
  const c10k = results.find((r) => r.fixture === "10000x12.md" && r.method === "mdtablepack-compact");
  const m10k = results.find((r) => r.fixture === "10000x12.md" && r.method === "markdown-raw");
  if (c10k && m10k) {
    const pct = m10k.estTokens === 0 ? 0 : Math.round((1 - c10k.estTokens / m10k.estTokens) * 100);
    lines.push("");
    lines.push("10000x12: raw markdown **" + m10k.bytes + " bytes / " + m10k.estTokens + " est. tokens**; compact **" + c10k.bytes + " bytes / " + c10k.estTokens + " est. tokens** (" + c10k.medianMs + " ms). Savings vs raw: **" + pct + "%** (estimate).");
  }
  lines.push("");
  lines.push("## Methods");
  lines.push("");
  lines.push("1. mdtableops read json — spawn node_modules/mdtableops/dist/cli.js after ops is built.");
  lines.push("2. Raw Markdown — UTF-8 bytes of the table range only (no heading).");
  lines.push("3. mdtablepack query --format jsonl");
  lines.push("4. mdtablepack query --format compact (default)");
  lines.push("5. compact with --select sku,qty --contains loc=east");
  lines.push("6. compact --limit 10 (first page)");
  lines.push("7. compact --max-tokens 250");
  lines.push("");
  lines.push("Wall time is median of 5 runs (10/100 rows), 3 runs (1000), 1 run (10000). Includes process spawn.");
  lines.push("");
  writeFileSync(path.join(root, "BENCHMARK.md"), lines.join("\n") + "\n");
  console.log("wrote BENCHMARK.md (" + String(results.length) + " rows)");
}

main();
