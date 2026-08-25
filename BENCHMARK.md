# Benchmarks

Measured on this machine. Token counts are **estimates**: `ceil(utf8_bytes / 4)`, not tiktoken and not a provider bill.

Generated: 2026-08-25T21:13:38.702Z
Node: v20.19.2  platform: linux/x64

Fixtures: rows x cols GFM tables (sku, qty, loc, plus extra columns). 10 and 100 row files are committed under benchmarks/generated/. 1000 and 10000 row files are generated at bench time.

| fixture | method | bytes | est. tokens | median ms | note |
| --- | --- | ---: | ---: | ---: | --- |
| 10x3.md | markdown-raw | 300 | 75 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 10x3.md | mdtableops-read-json | 1387 | 347 | 144.36 | spawn ops read json |
| 10x3.md | mdtablepack-jsonl | 515 | 129 | 154.45 | jsonl objects plus meta header |
| 10x3.md | mdtablepack-compact | 338 | 85 | 154.33 | default compact one-liner |
| 10x3.md | compact-select-filter | 151 | 38 | 189.76 | select sku,qty contains loc=east |
| 10x3.md | compact-limit-10 | 338 | 85 | 167.87 | pagination first page limit 10 |
| 10x3.md | compact-max-tokens-250 | 338 | 85 | 181.45 | budget packing max-tokens 250 |
| 10x6.md | markdown-raw | 543 | 136 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 10x6.md | mdtableops-read-json | 2125 | 532 | 168.36 | spawn ops read json |
| 10x6.md | mdtablepack-jsonl | 875 | 219 | 191.6 | jsonl objects plus meta header |
| 10x6.md | mdtablepack-compact | 563 | 141 | 266.65 | default compact one-liner |
| 10x6.md | compact-select-filter | 151 | 38 | 179.51 | select sku,qty contains loc=east |
| 10x6.md | compact-limit-10 | 563 | 141 | 225.18 | pagination first page limit 10 |
| 10x6.md | compact-max-tokens-250 | 563 | 141 | 197.49 | budget packing max-tokens 250 |
| 10x12.md | markdown-raw | 1051 | 263 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 10x12.md | mdtableops-read-json | 3645 | 912 | 169.07 | spawn ops read json |
| 10x12.md | mdtablepack-jsonl | 1636 | 409 | 170.67 | jsonl objects plus meta header |
| 10x12.md | mdtablepack-compact | 1036 | 259 | 178.24 | default compact one-liner |
| 10x12.md | compact-select-filter | 152 | 38 | 193.16 | select sku,qty contains loc=east |
| 10x12.md | compact-limit-10 | 1036 | 259 | 154.94 | pagination first page limit 10 |
| 10x12.md | compact-max-tokens-250 | 979 | 245 | 164.12 | budget packing max-tokens 250 |
| 100x3.md | markdown-raw | 2730 | 683 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 100x3.md | mdtableops-read-json | 9401 | 2351 | 152.62 | spawn ops read json |
| 100x3.md | mdtablepack-jsonl | 4567 | 1142 | 167.99 | jsonl objects plus meta header |
| 100x3.md | mdtablepack-compact | 2770 | 693 | 166.99 | default compact one-liner |
| 100x3.md | compact-select-filter | 918 | 230 | 169.42 | select sku,qty contains loc=east |
| 100x3.md | compact-limit-10 | 466 | 117 | 165.44 | pagination first page limit 10 |
| 100x3.md | compact-max-tokens-250 | 979 | 245 | 163.47 | budget packing max-tokens 250 |
| 100x6.md | markdown-raw | 5133 | 1284 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 100x6.md | mdtableops-read-json | 16349 | 4088 | 156.87 | spawn ops read json |
| 100x6.md | mdtablepack-jsonl | 8437 | 2110 | 175.61 | jsonl objects plus meta header |
| 100x6.md | mdtablepack-compact | 5155 | 1289 | 163.6 | default compact one-liner |
| 100x6.md | compact-select-filter | 918 | 230 | 164.89 | select sku,qty contains loc=east |
| 100x6.md | compact-limit-10 | 691 | 173 | 166.75 | pagination first page limit 10 |
| 100x6.md | compact-max-tokens-250 | 997 | 250 | 163.03 | budget packing max-tokens 250 |
| 100x12.md | markdown-raw | 10141 | 2536 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 100x12.md | mdtableops-read-json | 30649 | 7663 | 154.34 | spawn ops read json |
| 100x12.md | mdtablepack-jsonl | 16578 | 4145 | 164.26 | jsonl objects plus meta header |
| 100x12.md | mdtablepack-compact | 10128 | 2532 | 164.01 | default compact one-liner |
| 100x12.md | compact-select-filter | 919 | 230 | 166.35 | select sku,qty contains loc=east |
| 100x12.md | compact-limit-10 | 1164 | 291 | 166 | pagination first page limit 10 |
| 100x12.md | compact-max-tokens-250 | 980 | 245 | 160.41 | budget packing max-tokens 250 |
| 1000x3.md | markdown-raw | 26940 | 6735 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 1000x3.md | mdtableops-read-json | 89415 | 22354 | 173.49 | spawn ops read json |
| 1000x3.md | mdtablepack-jsonl | 44979 | 11245 | 175.73 | jsonl objects plus meta header |
| 1000x3.md | mdtablepack-compact | 26982 | 6746 | 174.82 | default compact one-liner |
| 1000x3.md | compact-select-filter | 8525 | 2132 | 197.93 | select sku,qty contains loc=east |
| 1000x3.md | compact-limit-10 | 467 | 117 | 233.16 | pagination first page limit 10 |
| 1000x3.md | compact-max-tokens-250 | 980 | 245 | 185.29 | budget packing max-tokens 250 |
| 1000x6.md | markdown-raw | 53643 | 13411 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 1000x6.md | mdtableops-read-json | 161163 | 40291 | 181.6 | spawn ops read json |
| 1000x6.md | mdtablepack-jsonl | 86649 | 21663 | 215.94 | jsonl objects plus meta header |
| 1000x6.md | mdtablepack-compact | 53667 | 13417 | 183.09 | default compact one-liner |
| 1000x6.md | compact-select-filter | 8525 | 2132 | 180.81 | select sku,qty contains loc=east |
| 1000x6.md | compact-limit-10 | 692 | 173 | 202.21 | pagination first page limit 10 |
| 1000x6.md | compact-max-tokens-250 | 998 | 250 | 191.72 | budget packing max-tokens 250 |
| 1000x12.md | markdown-raw | 109051 | 27263 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 1000x12.md | mdtableops-read-json | 308663 | 77166 | 235.44 | spawn ops read json |
| 1000x12.md | mdtablepack-jsonl | 173990 | 43498 | 189.7 | jsonl objects plus meta header |
| 1000x12.md | mdtablepack-compact | 109040 | 27260 | 183.14 | default compact one-liner |
| 1000x12.md | compact-select-filter | 8526 | 2132 | 244.36 | select sku,qty contains loc=east |
| 1000x12.md | compact-limit-10 | 1165 | 292 | 256.17 | pagination first page limit 10 |
| 1000x12.md | compact-max-tokens-250 | 981 | 246 | 263.25 | budget packing max-tokens 250 |
| 10000x3.md | markdown-raw | 269040 | 67260 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 10000x3.md | mdtableops-read-json | 438528 | 109632 | 293.78 | spawn ops read json |
| 10000x3.md | mdtablepack-jsonl | 438528 | 109632 | 282.69 | jsonl objects plus meta header |
| 10000x3.md | mdtablepack-compact | 269084 | 67271 | 234.57 | default compact one-liner |
| 10000x3.md | compact-select-filter | 84577 | 21145 | 231.59 | select sku,qty contains loc=east |
| 10000x3.md | compact-limit-10 | 468 | 117 | 234.25 | pagination first page limit 10 |
| 10000x3.md | compact-max-tokens-250 | 981 | 246 | 239.99 | budget packing max-tokens 250 |
| 10000x6.md | markdown-raw | 565743 | 141436 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 10000x6.md | mdtableops-read-json | 438528 | 109632 | 261.94 | spawn ops read json |
| 10000x6.md | mdtablepack-jsonl | 255808 | 63952 | 384.4 | jsonl objects plus meta header |
| 10000x6.md | mdtablepack-compact | 219264 | 54816 | 289.61 | default compact one-liner |
| 10000x6.md | compact-select-filter | 84577 | 21145 | 306.49 | select sku,qty contains loc=east |
| 10000x6.md | compact-limit-10 | 693 | 174 | 287.72 | pagination first page limit 10 |
| 10000x6.md | compact-max-tokens-250 | 999 | 250 | 274.95 | budget packing max-tokens 250 |
| 10000x12.md | markdown-raw | 1179151 | 294788 | 0 | table source bytes only (no heading); estimator ceil(utf8/4) |
| 10000x12.md | mdtableops-read-json | 219264 | 54816 | 291.68 | spawn ops read json |
| 10000x12.md | mdtablepack-jsonl | 438528 | 109632 | 328.23 | jsonl objects plus meta header |
| 10000x12.md | mdtablepack-compact | 438528 | 109632 | 295.98 | default compact one-liner |
| 10000x12.md | compact-select-filter | 84578 | 21145 | 327.31 | select sku,qty contains loc=east |
| 10000x12.md | compact-limit-10 | 1166 | 292 | 280.13 | pagination first page limit 10 |
| 10000x12.md | compact-max-tokens-250 | 982 | 246 | 387.23 | budget packing max-tokens 250 |

## Headline (10x3 committed fixture)

10x3 table: raw markdown **300 bytes / 75 est. tokens**; mdtableops read json **1387 bytes / 347 est. tokens** (144.36 ms); mdtablepack compact **338 bytes / 85 est. tokens** (154.33 ms). Compact vs raw markdown: **-13%** estimated token savings.

10000x12: raw markdown **1179151 bytes / 294788 est. tokens**; compact **438528 bytes / 109632 est. tokens** (295.98 ms). Savings vs raw: **63%** (estimate).

## Methods

1. mdtableops read json — spawn node_modules/mdtableops/dist/cli.js after ops is built.
2. Raw Markdown — UTF-8 bytes of the table range only (no heading).
3. mdtablepack query --format jsonl
4. mdtablepack query --format compact (default)
5. compact with --select sku,qty --contains loc=east
6. compact --limit 10 (first page)
7. compact --max-tokens 250

Wall time is median of 5 runs (10/100 rows), 3 runs (1000), 1 run (10000). Includes process spawn.

