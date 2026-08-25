import { describe, expect, it } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";
import { EXIT } from "mdtableops";
import { run } from "../src/main.js";
import { decodeCursor } from "../src/cursor.js";
import { renderMarkdown, renderTsv, renderJsonl } from "../src/format.js";
import { commandHelp, parseArgv, requireFile, requirePath } from "../src/argv.js";
import { mockIo, withTempDir, writeMd, warehouse } from "./helpers.js";
import { formatError, usage } from "../src/errors.js";
import { AppError } from "mdtableops";
import { packQuery } from "../src/query.js";
import { parseMarkdown } from "mdtableops";

describe("extra branches", () => {
  it("commandHelp covers both commands", () => {
    expect(commandHelp("catalog")).toContain("catalog");
    expect(commandHelp("query")).toContain("--max-tokens");
  });

  it("require helpers", () => {
    const empty = parseArgv(["--help"]);
    expect(() => requireFile(empty)).toThrow(AppError);
    expect(() => requirePath(empty)).toThrow(AppError);
    expect(usage("x").exitCode).toBe(EXIT.usage);
    const err = new AppError("boom", EXIT.error, { file: "f", table: "t", column: "c", line: 3 });
    expect(formatError(err)).toContain("file: f");
    expect(formatError(err)).toContain("line: 3");
  });

  it("renderers", () => {
    expect(renderTsv(["a", "b"], [["1\t2", "x\ny"]])).toContain("a\tb");
    expect(renderMarkdown(["a"], ["none"], [["1"]])).toContain("|");
    const jsonl = renderJsonl({
      id: "root-1",
      columns: ["a", "a"],
      rows: [["1", "2"]],
      more: true,
      cursor: "abc",
    });
    expect(jsonl.split("\n")[0]).toContain("mdtablepack-meta");
    expect(JSON.parse(jsonl.split("\n")[1]!).a).toBe("1");
  });

  it("catalog skips hidden and node_modules; empty dir; not a file", async () => {
    await withTempDir(async (dir) => {
      const empty = path.join(dir, "empty");
      await fs.mkdir(empty);
      const e = mockIo();
      expect(await run(["catalog", empty], e.io)).toBe(0);
      expect(JSON.parse(e.stdout()).tables).toEqual([]);

      const nm = path.join(dir, "node_modules");
      await fs.mkdir(nm);
      await writeMd(nm, "x.md", warehouse);
      const hide = path.join(dir, ".secret");
      await fs.mkdir(hide);
      await writeMd(hide, "x.md", warehouse);
      await writeMd(dir, "ok.md", warehouse);
      const c = mockIo();
      expect(await run(["catalog", dir], c.io)).toBe(0);
      const files = JSON.parse(c.stdout()).tables.map((t: { file: string }) => t.file);
      expect(files.some((f: string) => f.includes("ok.md"))).toBe(true);
      expect(files.some((f: string) => f.includes("node_modules"))).toBe(false);
    });
  });

  it("invalid where-json, unknown error path, json catalog verbose", async () => {
    await withTempDir(async (dir) => {
      const file = await writeMd(dir, "w.md", warehouse);
      const bad = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--where-json", "{"], bad.io)).toBe(
        EXIT.usage,
      );
      const notObj = mockIo();
      expect(
        await run(["query", file, "--table-id", "warehouse-1", "--where-json", "[1]"], notObj.io),
      ).toBe(EXIT.usage);

      const v = mockIo();
      expect(await run(["catalog", file, "--format", "json", "--verbose"], v.io)).toBe(0);
      expect(v.stderr()).toContain("originalTokens=");

      const missq = mockIo();
      expect(await run(["query", path.join(dir, "missing.md"), "--table-id", "x"], missq.io)).toBe(
        EXIT.error,
      );
    });
  });

  it("packQuery json/tsv/markdown formats and limit 0", () => {
    const doc = parseMarkdown(Buffer.from(warehouse), "w.md");
    const table = doc.tables[0]!;
    const z = packQuery(table, "w.md", {
      tableId: "warehouse-1",
      gte: [],
      lte: [],
      gt: [],
      lt: [],
      contains: [],
      limit: 0,
      format: "compact",
    });
    expect(z.n).toBe(0);
    expect(z.more).toBe(true);
    const js = packQuery(table, "w.md", {
      tableId: "warehouse-1",
      gte: [],
      lte: [],
      gt: [],
      lt: [],
      contains: [],
      maxBytes: 10,
      format: "json",
    });
    expect(JSON.parse(js.text).data.rows.length).toBe(0);
    const tsv = packQuery(table, "w.md", {
      tableId: "warehouse-1",
      gte: [],
      lte: [],
      gt: [],
      lt: [],
      contains: [],
      format: "tsv",
    });
    expect(tsv.text.startsWith("sku")).toBe(true);
    const md = packQuery(table, "w.md", {
      tableId: "warehouse-1",
      gte: [],
      lte: [],
      gt: [],
      lt: [],
      contains: [],
      format: "markdown",
    });
    expect(md.text).toContain("A-100");
  });

  it("cursor offset past end", async () => {
    await withTempDir(async (dir) => {
      const file = await writeMd(dir, "w.md", warehouse);
      const cat = mockIo();
      await run(["catalog", file], cat.io);
      const hash = JSON.parse(cat.stdout()).tables[0].hash as string;
      const cur = Buffer.from(JSON.stringify({ hash, offset: 99 })).toString("base64url");
      const q = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--cursor", cur], q.io)).toBe(0);
      expect(JSON.parse(q.stdout()).n).toBe(0);
      expect(JSON.parse(q.stdout()).more).toBe(false);
      expect(decodeCursor(cur).offset).toBe(99);
    });
  });

  it("duplicate --gte filters AND; contains empty", async () => {
    await withTempDir(async (dir) => {
      const file = await writeMd(dir, "w.md", warehouse);
      const q = mockIo();
      expect(
        await run(
          ["query", file, "--table-id", "warehouse-1", "--gte", "qty=2", "--lte", "qty=2"],
          q.io,
        ),
      ).toBe(0);
      expect(JSON.parse(q.stdout()).r).toEqual([["A-100", "2", "us-east"]]);
      const c = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--contains", "sku="], c.io)).toBe(0);
      expect(JSON.parse(c.stdout()).n).toBe(3);
    });
  });
});
