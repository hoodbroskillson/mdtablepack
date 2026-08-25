# mdtablepack

**Token-budgeted reads for Markdown tables, built for AI agents.**

Companion to [mdtableops](https://github.com/hoodbroskillson/mdtableops). mdtableops writes tables safely; mdtablepack **reads** them in a compact, pageable form so agents do not burn a token budget on a 10 000-row inventory dump.

Read-only. No network. No API keys. No LLM. No MCP. No web UI. Never writes Markdown.

Copyright 2026 hoodbroskillson. MIT.

## Why compact

Agents often need two columns of a table, or the next 20 rows, not the whole GFM grid with padding and unused fields. Compact is **one JSON line** (default):

    {"v":1,"id":"warehouse-1","c":["sku","qty"],"r":[["A-100","2"],["B-200","5"],["C-300","0"]],"n":3,"more":false}

That payload is what `mdtablepack query examples/warehouse.md --table-id warehouse-1 --select sku,qty` prints (verified in unit tests: 111 bytes / 28 estimated tokens vs 113 bytes / 29 for the raw GFM table range). Tiny tables do not shrink much; JSON keys can even exceed padded pipes.

**Measured** (see BENCHMARK.md; estimator `ceil(utf8_bytes / 4)`, not tiktoken). 1000x12 fixture:

| method | bytes | est. tokens |
| --- | ---: | ---: |
| Raw Markdown table | 109,051 | 27,263 |
| mdtableops `read --json` | 308,663 | 77,166 |
| mdtablepack compact (full table) | 109,040 | 27,260 |
| compact `--select sku,qty --contains loc=east` | 8,526 | 2,132 |
| compact `--limit 10` | 1,165 | 292 |
| compact `--max-tokens 250` | 981 | 246 |

Projection+filter is **92%** fewer estimated tokens than the raw 1000x12 table. Compact vs mdtableops pretty JSON is **65%** smaller on that fixture. 10x3 compact is 338 bytes / 85 est. tokens vs mdtableops JSON 1,387 bytes / 347 est. tokens (**76%** smaller) and vs raw GFM 300 bytes / 75 est. tokens (slightly larger — honest). 10,000x3 compact tracked raw markdown (269,084 vs 269,040 bytes). `--max-tokens 250` stayed at ~246 estimated tokens across sizes.

## Install

Node 20+. Package name: `mdtablepack`. After publish, `npx mdtablepack` works. From a clone: install (postinstall compiles GitHub-installed mdtableops because that repo gitignores `dist/`), test, build, then invoke the `mdtablepack` binary (`package.json` `bin` points at `dist/cli.js`).

Dependency:

    "mdtableops": "github:hoodbroskillson/mdtableops#v1.0.0"

Do not copy the parser. Import `parseMarkdown`, `selectTable`, `findColumn`, `AppError`, `EXIT`, `sha256`, `readFileBytes` from `mdtableops`.

## Commands

    mdtablepack catalog PATH [--format compact|json]
    mdtablepack query FILE --table-id ID | --table NAME [options]

`catalog` PATH is a file or a directory of `.md` files. Each row: file, table id, heading path, columns, row count, source hash (mdtableops), estimated full-table tokens.

`query` options: `--select a,b`, `--where-json`, `--gte/--lte/--gt/--lt COL=NUM`, `--contains COL=SUBSTR`, `--limit N`, `--max-tokens N`, `--max-bytes N`, `--cursor CURSOR`, `--format compact|json|jsonl|tsv|markdown`, `--verbose`.

Budget: project and filter first, then emit **whole rows** until the next row would exceed the cap. Never split a row. Header metadata may exceed the budget; data rows must not.

Cursor is opaque base64url JSON `{hash, offset}`. If the table hash changed, exit 5.

See docs/CLI.md and docs/JSON_SCHEMA.md.

## Exit codes

Aligned with mdtableops: 0 success, 1 other error, 2 usage, 3 missing table, 4 ambiguous, 5 stale cursor/hash, 6 unused, 7 symlink refused.

## Library

    import { run, estimateTokens } from "mdtablepack";

TypeScript, ESM, Node 20+. Runtime dependency: mdtableops only.

## License

MIT, copyright hoodbroskillson
