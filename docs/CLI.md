# CLI

Executable: `mdtablepack`. Node 20+. Read-only companion to mdtableops.

    mdtablepack catalog PATH [--format compact|json]
    mdtablepack query FILE --table-id ID | --table NAME [options]

## Global flags

| Flag | Meaning |
| --- | --- |
| `--format` | `compact` (default), `json`, `jsonl`, `tsv`, `markdown`. Catalog allows compact or json. |
| `--follow-symlinks` | Allow PATH/FILE to be a symlink (default: refuse, exit 7) |
| `--verbose` | Human stats on stderr: originalTokens, returnedTokens, pctSaved (estimates) |
| `--help`, `-h` | Help |
| `--version`, `-V` | Version |

No ANSI on stdout. Errors go to stderr.

## catalog

    mdtablepack catalog PATH [--format compact|json] [--follow-symlinks]

PATH is a file or a directory of `.md` / `.markdown` files (recursive; skips node_modules, .git, dist, coverage, and hidden directories).

Each table: `file`, `id`, `headingPath` (compact: `h`), `columns` (`c`), `rowCount` (`n`), `sha256` (`hash`, mdtableops hash of exact table source bytes), `estimatedTokens` (`tok`, ceil(utf8_bytes/4) of those source bytes).

Compact is one JSON line: `{"v":1,"tables":[...]}`.

## query

    mdtablepack query FILE --table-id ID | --table NAME [options]

`--table` matching is mdtableops `selectTable`. Multiple matches → exit 4. Missing → exit 3.

| Flag | Meaning |
| --- | --- |
| `--select a,b` | Project columns (before budget) |
| `--where-json JSON` | Exact match on all keys (AND). Values coerced like mdtableops. |
| `--gte COL=NUM` | Numeric `>=` via parseFloat; non-numeric cells do not match |
| `--lte COL=NUM` | Numeric `<=` |
| `--gt COL=NUM` | Numeric `>` |
| `--lt COL=NUM` | Numeric `<` |
| `--contains COL=SUBSTR` | Case-insensitive substring |
| `--limit N` | Max rows this response (after cursor skip) |
| `--max-tokens N` | Stop before the next full row would exceed |
| `--max-bytes N` | Same, UTF-8 bytes |
| `--cursor CURSOR` | Resume; stale hash → exit 5 |

### Compact (default)

One line:

    {"v":1,"id":"warehouse-1","c":["sku","qty"],"r":[["A-100","2"]],"n":1,"more":false}

When more rows remain in the filtered set: `more:true` and `cursor` (base64url JSON `{hash, offset}`). `hash` is the mdtableops table sha256. `offset` is into the filtered+projected row list.

### Budget

Select, filter, then limit, then emit whole rows until the next row would exceed `--max-tokens` or `--max-bytes`. Never split a row. Metadata header may exceed the budget; data rows must not.

Token estimator: `ceil(utf8_bytes / 4)`. Estimate only; not tiktoken.

### Other formats

- `json` — envelope, see JSON_SCHEMA.md
- `jsonl` — first line `_type: mdtablepack-meta`, then row objects
- `tsv` — header + rows; pagination cursor on stderr when `more`
- `markdown` — GFM table via mdtableops `formatTable`; cursor on stderr when `more`

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success |
| 1 | other error |
| 2 | usage |
| 3 | table not found |
| 4 | ambiguous selection |
| 5 | stale cursor (table hash changed) |
| 6 | unused (mdtableops validation) |
| 7 | symlink refused |
