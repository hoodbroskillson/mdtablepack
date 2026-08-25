# JSON schema

## Compact (default stdout)

One line, no pretty print, trailing newline from the CLI.

    {
      "v": 1,
      "id": "warehouse-1",
      "c": ["sku", "qty"],
      "r": [["A-100", "2"]],
      "n": 1,
      "more": false,
      "cursor": "optional-when-more"
    }

`cursor` is omitted when `more` is false. It is opaque base64url of `{"hash":"<sha256>","offset":<int>}`.

## Catalog compact

    {"v":1,"tables":[{"file":"w.md","id":"warehouse-1","h":["Warehouse"],"c":["sku","qty","loc"],"n":3,"hash":"…","tok":42}]}

## Envelope (`--format json`)

Pretty-printed (2-space indent) plus trailing newline. No ANSI.

    {
      "schemaVersion": 1,
      "ok": true,
      "data": {},
      "diagnostics": [],
      "more": false,
      "cursor": "optional-when-more",
      "estimates": {
        "originalTokens": 0,
        "returnedTokens": 0,
        "savedPct": 0
      }
    }

`estimates` uses `ceil(utf8_bytes / 4)`. `originalTokens` is the selected table's source bytes (mdtableops table range). `returnedTokens` is the stdout payload. `savedPct` is `round((1 - returned/original) * 100)` and may be negative when the envelope is larger than the source table.

On errors, stdout is empty; the message is on stderr. The process exit code is still set.

## Catalog json

`data.tables` is an array of `{ file, id, headingPath, columns, rowCount, sha256, estimatedTokens }`.

## Query json

`data` is `{ id, headingPath, columns, rows, rowCount, sha256 }`. `rows` is an array of arrays aligned with `columns`.
