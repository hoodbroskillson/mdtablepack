# Changelog

## Unreleased

## 1.0.0 - 2026-08-25

GitHub tag `v1.0.0`. Not published to npm yet.

- `catalog PATH` lists tables in a file or directory of `.md` files
- `query FILE` reads one table with projection, filters, cursor pagination, and `--max-tokens` / `--max-bytes` budgets
- Compact one-line JSON default for agents; json / jsonl / tsv / markdown formats
- Token estimator `ceil(utf8_bytes / 4)` (estimate, not tiktoken)
- Depends on `mdtableops` v1.0.0 for parse/select/hash; postinstall compiles ops when GitHub install has no `dist/`
- Read-only: never writes Markdown files
