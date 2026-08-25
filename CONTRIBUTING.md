# Contributing

Copyright 2026 hoodbroskillson. MIT.

## Setup

Node 20+ (see `.nvmrc`). Install, test (Vitest coverage), lint (`tsc --noEmit`), build.

Coverage must stay at or above 90% lines. CI runs Node 20 and 22 on Ubuntu, Windows, and macOS.

## Rules

- Runtime dependency: mdtableops only. Do not reimplement the GFM parser; do not copy parse.ts.
- Argv is parsed in-tree.
- Do not add network, MCP, API-key, LLM, or web UI features.
- Do not write Markdown files.
- Ambiguous table selection must refuse (exit 4), never first-match.
- Compact default is one line. No ANSI on stdout.

## Commits

Author: hoodbroskillson / hoodbroskillson@users.noreply.github.com.
Do not put other personal names in LICENSE, README, commits, or source.
