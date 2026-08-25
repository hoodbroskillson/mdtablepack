# Security

mdtablepack is a local read-only CLI. It does not open network sockets, read API keys, execute Markdown, or write Markdown files.

## Reporting

Please use GitHub private vulnerability reporting on this repository:

https://github.com/hoodbroskillson/mdtablepack/security/advisories/new

## Scope notes

- PATH/FILE is read as bytes and parsed as GFM tables via mdtableops. Do not point it at files you do not intend to parse.
- Symlink files are refused unless `--follow-symlinks`.
- JSON flags are parsed as data, not code.
- Cursors are untrusted input: malformed cursor is usage (exit 2); hash mismatch is exit 5.
