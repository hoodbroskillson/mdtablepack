import { describe, expect, it } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { run } from "../src/cli.js";
import { EXIT } from "mdtableops";
import { mockIo, withTempDir, writeMd, warehouse, ambiguous, readFile } from "./helpers.js";
import { encodeCursor } from "../src/cursor.js";
import { estimateTokens, utf8Bytes } from "../src/tokens.js";

describe("cli run()", () => {
  it("prints version and help", async () => {
    const v = mockIo();
    expect(await run(["--version"], v.io)).toBe(0);
    expect(v.stdout().trim()).toBe("1.0.0");
    const h = mockIo();
    expect(await run(["--help"], h.io)).toBe(0);
    expect(h.stdout()).toContain("Token-budgeted");
    const ch = mockIo();
    expect(await run(["catalog", "--help"], ch.io)).toBe(0);
    expect(ch.stdout()).toContain("estimatedTokens");
    const qh = mockIo();
    expect(await run(["query", "--help"], qh.io)).toBe(0);
    expect(qh.stdout()).toContain("max-tokens");
  });

  it("usage on unknown command and missing path", async () => {
    const u = mockIo();
    expect(await run(["nope"], u.io)).toBe(EXIT.usage);
    expect(u.stderr()).toContain("mdtablepack:");
    const m = mockIo();
    expect(await run(["catalog"], m.io)).toBe(EXIT.usage);
    const n = mockIo();
    expect(await run([], n.io)).toBe(EXIT.usage);
    expect(n.stderr()).toContain("Usage:");
  });

  it("compact is one line; warehouse query and projection", async () => {
    await withTempDir(async (dir) => {
      const file = await writeMd(dir, "w.md", warehouse);
      const q = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1"], q.io)).toBe(0);
      const lines = q.stdout().trim().split("\n");
      expect(lines).toHaveLength(1);
      const obj = JSON.parse(q.stdout());
      expect(obj.v).toBe(1);
      expect(obj.id).toBe("warehouse-1");
      expect(obj.c).toEqual(["sku", "qty", "loc"]);
      expect(obj.r).toEqual([
        ["A-100", "2", "us-east"],
        ["B-200", "5", "eu-west"],
        ["C-300", "0", "us-east"],
      ]);
      expect(obj.n).toBe(3);
      expect(obj.more).toBe(false);
      expect(obj.cursor).toBeUndefined();
      expect(q.stdout()).not.toMatch(/\u001b\[/);

      const before = await readFile(file);
      const p = mockIo();
      expect(
        await run(["query", file, "--table", "Warehouse", "--select", "sku,qty"], p.io),
      ).toBe(0);
      const compact = JSON.parse(p.stdout());
      expect(compact.c).toEqual(["sku", "qty"]);
      expect(compact.r[0]).toEqual(["A-100", "2"]);
      expect(await readFile(file)).toEqual(before);
    });
  });

  it("catalog file and directory", async () => {
    await withTempDir(async (dir) => {
      await writeMd(dir, "w.md", warehouse);
      await writeMd(dir, "a.md", ambiguous);
      await writeMd(dir, "skip.txt", "| a | b |\n| --- | --- |\n| 1 | 2 |\n");
      const nested = path.join(dir, "sub");
      await fs.mkdir(nested);
      await writeMd(nested, "n.md", `# Nested\n\n| x |\n| --- |\n| 1 |\n`);

      const one = mockIo();
      expect(await run(["catalog", path.join(dir, "w.md")], one.io)).toBe(0);
      const c1 = JSON.parse(one.stdout());
      expect(c1.v).toBe(1);
      expect(c1.tables).toHaveLength(1);
      expect(c1.tables[0].id).toBe("warehouse-1");
      expect(c1.tables[0].c).toEqual(["sku", "qty", "loc"]);
      expect(c1.tables[0].n).toBe(3);
      expect(c1.tables[0].hash).toMatch(/^[0-9a-f]{64}$/);
      expect(typeof c1.tables[0].tok).toBe("number");
      expect(one.stdout().trim().split("\n")).toHaveLength(1);

      const dirIo = mockIo();
      expect(await run(["catalog", dir, "--format", "json"], dirIo.io)).toBe(0);
      const env = JSON.parse(dirIo.stdout());
      expect(env.schemaVersion).toBe(1);
      expect(env.ok).toBe(true);
      const ids = env.data.tables.map((t: { id: string }) => t.id).sort();
      expect(ids).toContain("warehouse-1");
      expect(ids).toContain("a-1");
      expect(ids).toContain("a-2");
      expect(ids).toContain("nested-1");
      expect(env.data.tables.every((t: { estimatedTokens: number }) => t.estimatedTokens >= 1)).toBe(true);
    });
  });

  it("ambiguous select, missing table, stale cursor, symlink", async () => {
    await withTempDir(async (dir) => {
      const file = await writeMd(dir, "t.md", ambiguous);
      const miss = mockIo();
      expect(await run(["query", file, "--table-id", "nope"], miss.io)).toBe(EXIT.missingTable);
      expect(miss.stderr()).toContain("mdtablepack:");
      expect(miss.stdout()).toBe("");
      const amb = mockIo();
      expect(await run(["query", file, "--table", "A"], amb.io)).toBe(EXIT.ambiguous);
      const stale = mockIo();
      const cur = encodeCursor("00", 0);
      expect(await run(["query", file, "--table-id", "a-1", "--cursor", cur], stale.io)).toBe(
        EXIT.hashMismatch,
      );

      const link = path.join(dir, "l.md");
      await fs.symlink(file, link);
      const sl = mockIo();
      expect(await run(["query", link, "--table-id", "a-1"], sl.io)).toBe(EXIT.symlink);
      const slc = mockIo();
      expect(await run(["catalog", link], slc.io)).toBe(EXIT.symlink);
      const ok = mockIo();
      expect(await run(["query", link, "--table-id", "a-1", "--follow-symlinks"], ok.io)).toBe(0);
    });
  });

  it("gte/contains, cursor resume, budget never splits a row", async () => {
    await withTempDir(async (dir) => {
      const file = await writeMd(dir, "w.md", warehouse);
      const gte = mockIo();
      expect(
        await run(["query", file, "--table-id", "warehouse-1", "--gte", "qty=2", "--select", "sku,qty"], gte.io),
      ).toBe(0);
      expect(JSON.parse(gte.stdout()).r).toEqual([
        ["A-100", "2"],
        ["B-200", "5"],
      ]);

      const contains = mockIo();
      expect(
        await run(["query", file, "--table-id", "warehouse-1", "--contains", "loc=EAST"], contains.io),
      ).toBe(0);
      expect(JSON.parse(contains.stdout()).n).toBe(2);

      const skipNonNum = mockIo();
      const mixed = await writeMd(
        dir,
        "m.md",
        `| n | v |\n| --- | --- |\n| a | x |\n| 3 | y |\n| 10 | z |\n`,
      );
      expect(await run(["query", mixed, "--table-id", "root-1", "--gt", "n=2"], skipNonNum.io)).toBe(0);
      expect(JSON.parse(skipNonNum.stdout()).r.map((r: string[]) => r[0])).toEqual(["3", "10"]);

      const page1 = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--limit", "1"], page1.io)).toBe(0);
      const p1 = JSON.parse(page1.stdout());
      expect(p1.n).toBe(1);
      expect(p1.more).toBe(true);
      expect(typeof p1.cursor).toBe("string");
      expect(p1.r[0][0]).toBe("A-100");
      const page2 = mockIo();
      expect(
        await run(["query", file, "--table-id", "warehouse-1", "--limit", "1", "--cursor", p1.cursor], page2.io),
      ).toBe(0);
      const p2 = JSON.parse(page2.stdout());
      expect(p2.r[0][0]).toBe("B-200");
      expect(p2.more).toBe(true);
      const page3 = mockIo();
      expect(
        await run(["query", file, "--table-id", "warehouse-1", "--cursor", p2.cursor], page3.io),
      ).toBe(0);
      const p3 = JSON.parse(page3.stdout());
      expect(p3.r[0][0]).toBe("C-300");
      expect(p3.more).toBe(false);

      const many = ["# M", "", "| k | v |", "| --- | --- |"]
        .concat(Array.from({ length: 12 }, (_, i) => `| ${String(i)} | ${"x".repeat(24)} |`))
        .join("\n");
      const manyFile = await writeMd(dir, "many.md", many);
      const allMany = mockIo();
      expect(await run(["query", manyFile, "--table-id", "m-1"], allMany.io)).toBe(0);
      const allN = JSON.parse(allMany.stdout()).n as number;
      expect(allN).toBe(12);
      const oneMany = mockIo();
      expect(await run(["query", manyFile, "--table-id", "m-1", "--limit", "1"], oneMany.io)).toBe(0);
      const allBytes = utf8Bytes(allMany.stdout().trim());
      const oneBytes = utf8Bytes(oneMany.stdout().trim());
      expect(allBytes).toBeGreaterThan(oneBytes);
      const maxBytes = oneBytes + Math.floor((allBytes - oneBytes) / 4);
      const bud = mockIo();
      expect(await run(["query", manyFile, "--table-id", "m-1", "--max-bytes", String(maxBytes)], bud.io)).toBe(0);
      const packed = JSON.parse(bud.stdout());
      expect(packed.r.length).toBeGreaterThanOrEqual(1);
      expect(packed.r.length).toBeLessThan(allN);
      packed.r.forEach((row: unknown) => {
        expect(Array.isArray(row)).toBe(true);
        expect((row as string[]).length).toBe(2);
      });
      expect(packed.more).toBe(true);
    });
  });

  it("projection before budget lets more rows fit", async () => {
    await withTempDir(async (dir) => {
      const wide = `# W\n\n| a | b |\n| --- | --- |\n| ${"X".repeat(40)} | 1 |\n| ${"Y".repeat(40)} | 2 |\n`;
      const file = await writeMd(dir, "w.md", wide);
      const all = mockIo();
      expect(await run(["query", file, "--table-id", "w-1", "--max-bytes", "80"], all.io)).toBe(0);
      const without = JSON.parse(all.stdout());
      const proj = mockIo();
      expect(
        await run(["query", file, "--table-id", "w-1", "--select", "b", "--max-bytes", "80"], proj.io),
      ).toBe(0);
      const withp = JSON.parse(proj.stdout());
      expect(withp.n).toBeGreaterThan(without.n);
      expect(withp.c).toEqual(["b"]);
    });
  });

  it("json envelope, jsonl, tsv, markdown; verbose estimates; no ANSI", async () => {
    await withTempDir(async (dir) => {
      const file = await writeMd(dir, "w.md", warehouse);
      const js = mockIo();
      expect(
        await run(["query", file, "--table-id", "warehouse-1", "--format", "json", "--verbose"], js.io),
      ).toBe(0);
      expect(js.stdout()).not.toMatch(/\u001b\[/);
      const env = JSON.parse(js.stdout());
      expect(env.schemaVersion).toBe(1);
      expect(env.ok).toBe(true);
      expect(env.data.id).toBe("warehouse-1");
      expect(env.data.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(env.more).toBe(false);
      expect(env.estimates.originalTokens).toBeGreaterThan(0);
      expect(env.estimates.returnedTokens).toBeGreaterThan(0);
      expect(js.stderr()).toContain("originalTokens=");
      expect(js.stderr()).toContain("returnedTokens=");
      expect(js.stderr()).toContain("pctSaved=");
      expect(js.stderr()).toContain("estimate:");

      const jsonl = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--format", "jsonl"], jsonl.io)).toBe(0);
      const jl = jsonl.stdout().trim().split("\n");
      expect(JSON.parse(jl[0]!)._type).toBe("mdtablepack-meta");
      expect(JSON.parse(jl[1]!).sku).toBe("A-100");

      const tsv = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--format", "tsv", "--limit", "1"], tsv.io)).toBe(
        0,
      );
      expect(tsv.stdout().split("\n")[0]).toContain("sku");
      expect(tsv.stderr()).toContain("more=true");
      expect(tsv.stdout()).not.toMatch(/\u001b\[/);

      const md = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--format", "markdown"], md.io)).toBe(0);
      expect(md.stdout()).toContain("|");
      expect(md.stdout()).toContain("A-100");
    });
  });

  it("where-json exact, lt/lte, catalog format refuse, missing file, invalid cursor", async () => {
    await withTempDir(async (dir) => {
      const file = await writeMd(dir, "w.md", warehouse);
      const w = mockIo();
      expect(
        await run(
          ["query", file, "--table-id", "warehouse-1", "--where-json", JSON.stringify({ loc: "eu-west" })],
          w.io,
        ),
      ).toBe(0);
      expect(JSON.parse(w.stdout()).r).toEqual([["B-200", "5", "eu-west"]]);

      const lt = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--lt", "qty=2"], lt.io)).toBe(0);
      expect(JSON.parse(lt.stdout()).n).toBe(1);
      const lte = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--lte", "qty=2"], lte.io)).toBe(0);
      expect(JSON.parse(lte.stdout()).n).toBe(2);

      const badf = mockIo();
      expect(await run(["catalog", file, "--format", "tsv"], badf.io)).toBe(EXIT.usage);

      const miss = mockIo();
      expect(await run(["catalog", path.join(dir, "nope.md")], miss.io)).toBe(EXIT.error);

      const cur = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--cursor", "%%%"], cur.io)).toBe(
        EXIT.usage,
      );

      const col = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--select", "nope"], col.io)).toBe(
        EXIT.error,
      );

      const qn = mockIo();
      expect(await run(["query", file], qn.io)).toBe(EXIT.usage);
    });
  });

  it("max-tokens empty page when first row cannot fit; header still emitted", async () => {
    await withTempDir(async (dir) => {
      const file = await writeMd(dir, "w.md", warehouse);
      const tiny = mockIo();
      expect(await run(["query", file, "--table-id", "warehouse-1", "--max-tokens", "1"], tiny.io)).toBe(0);
      const obj = JSON.parse(tiny.stdout());
      expect(obj.v).toBe(1);
      expect(obj.r).toEqual([]);
      expect(obj.n).toBe(0);
      expect(obj.more).toBe(true);
      expect(typeof obj.cursor).toBe("string");
    });
  });
});

describe("spawn dist/cli.js", () => {
  it("direct run version when dist exists", () => {
    const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
    if (!existsSync(cli)) return;
    const r = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("1.0.0");
  });
});

describe("measured warehouse example (README numbers)", () => {
  it("compact is smaller than raw markdown table", async () => {
    await withTempDir(async (dir) => {
      const file = await writeMd(dir, "w.md", warehouse);
      const cat = mockIo();
      expect(await run(["catalog", file, "--format", "json"], cat.io)).toBe(0);
      const tok = JSON.parse(cat.stdout()).data.tables[0].estimatedTokens as number;
      const q = mockIo();
      expect(
        await run(["query", file, "--table-id", "warehouse-1", "--select", "sku,qty"], q.io),
      ).toBe(0);
      const compact = q.stdout().trim();
      const compactTok = estimateTokens(compact);
      expect(compactTok).toBeLessThan(tok);
      expect(compact).toBe(
        '{"v":1,"id":"warehouse-1","c":["sku","qty"],"r":[["A-100","2"],["B-200","5"],["C-300","0"]],"n":3,"more":false}',
      );
    });
  });
});
