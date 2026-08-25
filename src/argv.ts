import { usage } from "./errors.js";
import { VERSION } from "./version.js";

export const COMMANDS = ["catalog", "query"] as const;
export type CommandName = (typeof COMMANDS)[number];

export const FORMATS = ["compact", "json", "jsonl", "tsv", "markdown"] as const;
export type FormatName = (typeof FORMATS)[number];

export interface ColNum {
  col: string;
  n: number;
}

export interface ColSubstr {
  col: string;
  substr: string;
}

export interface ParsedArgs {
  command?: CommandName;
  path?: string;
  format: FormatName;
  followSymlinks: boolean;
  help: boolean;
  version: boolean;
  verbose: boolean;
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
}

const FLAGS_WITH_VALUE = new Set([
  "--format",
  "--table",
  "--table-id",
  "--select",
  "--where-json",
  "--gte",
  "--lte",
  "--gt",
  "--lt",
  "--contains",
  "--limit",
  "--max-tokens",
  "--max-bytes",
  "--cursor",
]);

function isCommand(s: string): s is CommandName {
  return (COMMANDS as readonly string[]).includes(s);
}

function isFormat(s: string): s is FormatName {
  return (FORMATS as readonly string[]).includes(s);
}

function csv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function parseIntFlag(flag: string, val: string): number {
  if (!/^\d+$/.test(val)) {
    throw usage(`${flag} must be a non-negative integer`);
  }
  const n = Number(val);
  if (!Number.isSafeInteger(n)) {
    throw usage(`${flag} is too large`);
  }
  return n;
}

function parseColEq(flag: string, val: string): { col: string; rest: string } {
  const i = val.indexOf("=");
  if (i <= 0) {
    throw usage(`${flag} expected COL=VALUE`);
  }
  const col = val.slice(0, i).trim();
  const rest = val.slice(i + 1);
  if (!col) {
    throw usage(`${flag} expected COL=VALUE`);
  }
  return { col, rest };
}

function parseColNum(flag: string, val: string): ColNum {
  const { col, rest } = parseColEq(flag, val);
  const n = Number.parseFloat(rest);
  if (!Number.isFinite(n)) {
    throw usage(`${flag} expected COL=number`);
  }
  return { col, n };
}

export function parseArgv(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    format: "compact",
    followSymlinks: false,
    help: false,
    version: false,
    verbose: false,
    gte: [],
    lte: [],
    gt: [],
    lt: [],
    contains: [],
  };
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a === "-h" || a === "--help") {
      out.help = true;
      continue;
    }
    if (a === "-V" || a === "--version") {
      out.version = true;
      continue;
    }
    if (a === "--verbose") {
      out.verbose = true;
      continue;
    }
    if (a === "--follow-symlinks") {
      out.followSymlinks = true;
      continue;
    }
    if (FLAGS_WITH_VALUE.has(a)) {
      const val = argv[i + 1];
      if (val === undefined || (val.startsWith("-") && !/^-\d/.test(val))) {
        throw usage(`missing value for ${a}`);
      }
      i++;
      switch (a) {
        case "--format":
          if (!isFormat(val)) {
            throw usage(`unknown --format ${val} (compact|json|jsonl|tsv|markdown)`);
          }
          out.format = val;
          break;
        case "--table":
          out.table = val;
          break;
        case "--table-id":
          out.tableId = val;
          break;
        case "--select":
          out.select = csv(val);
          if (out.select.length === 0) {
            throw usage("--select needs at least one column");
          }
          break;
        case "--where-json":
          out.whereJson = val;
          break;
        case "--gte":
          out.gte.push(parseColNum("--gte", val));
          break;
        case "--lte":
          out.lte.push(parseColNum("--lte", val));
          break;
        case "--gt":
          out.gt.push(parseColNum("--gt", val));
          break;
        case "--lt":
          out.lt.push(parseColNum("--lt", val));
          break;
        case "--contains": {
          const { col, rest } = parseColEq("--contains", val);
          out.contains.push({ col, substr: rest });
          break;
        }
        case "--limit":
          out.limit = parseIntFlag("--limit", val);
          break;
        case "--max-tokens":
          out.maxTokens = parseIntFlag("--max-tokens", val);
          break;
        case "--max-bytes":
          out.maxBytes = parseIntFlag("--max-bytes", val);
          break;
        case "--cursor":
          out.cursor = val;
          break;
      }
      continue;
    }
    if (a.startsWith("-")) {
      throw usage(`unknown option: ${a}`);
    }
    positionals.push(a);
  }
  if (positionals[0] === "help") {
    out.help = true;
    positionals.shift();
  }
  if (positionals[0] && isCommand(positionals[0])) {
    out.command = positionals[0];
    positionals.shift();
  } else if (positionals[0] && !out.help && !out.version) {
    throw usage(`unknown command: ${positionals[0]}`);
  }
  if (positionals[0]) out.path = positionals[0];
  if (positionals.length > 1) {
    throw usage(`unexpected extra arguments: ${positionals.slice(1).join(" ")}`);
  }
  return out;
}

export function requirePath(args: ParsedArgs): string {
  if (!args.path) throw usage("missing PATH argument");
  return args.path;
}

export function requireFile(args: ParsedArgs): string {
  if (!args.path) throw usage("missing FILE argument");
  return args.path;
}

export const HELP_MAIN = `mdtablepack ${VERSION} — Token-budgeted reads for Markdown tables, built for AI agents.

Usage:
  mdtablepack catalog PATH [--format compact|json]
  mdtablepack query FILE --table-id ID | --table NAME [options]
  mdtablepack --help
  mdtablepack --version

Companion to mdtableops. Read-only: never writes Markdown. No network, no API keys, no LLM.

Commands:
  catalog    List tables in a file or directory of .md files
  query      Read one table with projection, filters, cursor, and token budget

Global options:
  --format compact|json|jsonl|tsv|markdown
                         Output format (default: compact; catalog: compact|json)
  --follow-symlinks      Allow FILE to be a symlink (default: refuse)
  --verbose              Human stats on stderr (estimated tokens)
  --help, -h             Show help
  --version, -V          Show version

Token estimator (v1): ceil(utf8_bytes / 4). Estimate only; not tiktoken.

Exit codes:
  0 success
  1 other error
  2 usage
  3 table not found
  4 ambiguous table selection
  5 stale cursor (table hash changed)
  6 unused (mdtableops validation)
  7 symlink refused

See also: mdtablepack <command> --help
`;

export function commandHelp(cmd: CommandName): string {
  switch (cmd) {
    case "catalog":
      return `mdtablepack catalog PATH [--format compact|json] [--follow-symlinks]

PATH is a Markdown file or a directory of .md files (recursive; skips
node_modules, .git, dist, coverage, and hidden directories).

Each table: file, id, heading path, columns, row count, sha256 (mdtableops
hash of exact table source bytes), estimatedTokens (ceil(utf8_bytes / 4)
of those source bytes).

Compact (default) is one JSON line. json is a versioned envelope.
`;
    case "query":
      return `mdtablepack query FILE --table-id ID | --table NAME [options]

Read-only. NAME matching is mdtableops selectTable (ambiguous → exit 4).

Options:
  --select a,b           Project columns (applied before budget)
  --where-json JSON      Exact string match on all keys (AND)
  --gte COL=NUM          Numeric >= (parseFloat; skip non-numeric cells)
  --lte COL=NUM          Numeric <=
  --gt COL=NUM           Numeric >
  --lt COL=NUM           Numeric <
  --contains COL=SUBSTR  Case-insensitive substring
  --limit N              Max rows this response (after cursor skip)
  --max-tokens N         Stop before the next full row would exceed
  --max-bytes N          Same, in UTF-8 bytes
  --cursor CURSOR        Resume; refuse if table hash changed (exit 5)
  --format compact|json|jsonl|tsv|markdown
  --verbose              stderr: originalTokens returnedTokens pctSaved

Budget: select/filter/limit first, then emit whole rows until the next
row would exceed --max-tokens or --max-bytes. Never split a row.
The metadata header may exceed the budget; data rows must not.

Compact (default, one line):
  {"v":1,"id":"warehouse-1","c":["sku","qty"],"r":[["A-100","2"]],"n":1,"more":false}
When truncated: more=true and cursor is base64url JSON {hash, offset}.

Cursor hash is the mdtableops table sha256. Offset is into the
filtered+projected row list.
`;
  }
}
