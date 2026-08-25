# AGENTS.md

How to use mdtablepack from another agent. This is a CLI, not an MCP server and not a chat app. Companion to mdtableops (writes). mdtablepack is read-only.

## Workflow

1. Catalog PATH. Copy id and hash.
2. Query FILE with --table-id ID. Default compact one-liner.
3. If more is true, pass --cursor from the response. Exit 5 means the table hash changed; re-catalog.
4. Use --select and filters before --max-tokens so the budget applies to the reduced table.
5. --verbose prints estimated originalTokens, returnedTokens, pctSaved on stderr (not a provider invoice).

Never guess when catalog shows two tables under the same heading. Use --table-id. Exit 4 means the name was ambiguous; do not retry the same --table name.

## Selection

- Prefer --table-id warehouse-1 over --table Warehouse.
- Table ids and sha256 hashes are produced by mdtableops.
- --table matching more than one table fails closed (exit 4). There is no first-match.

## Compact stdout

Default format is one JSON line, no pretty print, no ANSI.

When truncated: more=true and cursor is base64url JSON {hash, offset}.

--format json is a versioned envelope (schemaVersion 1) with ok, data, diagnostics, more, cursor, estimates.

Machine formats have no prose on stdout. Errors go to stderr. Exit codes still apply.

## Budget

- Apply select / filter / limit first.
- Emit whole rows until the next full row would exceed --max-tokens or --max-bytes.
- Never split a row. A single huge row that cannot fit is omitted; more stays true so you can raise the budget.
- The metadata header may exceed the budget; data rows must not.
- Tokens are ceil(utf8_bytes / 4). Estimate only.

## Do not

- Do not write the Markdown file (there is no --write).
- Do not send the file to a network API.
- Do not assume token counts match a provider tokenizer.
- Do not parse tables yourself; mdtableops already skips fenced code.
