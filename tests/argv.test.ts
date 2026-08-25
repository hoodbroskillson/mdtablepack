import { describe, expect, it } from "vitest";
import { parseArgv } from "../src/argv.js";
import { AppError, EXIT } from "mdtableops";

function throwsUsage(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).exitCode).toBe(EXIT.usage);
    return (err as Error).message;
  }
  throw new Error("expected usage error");
}

describe("parseArgv", () => {
  it("defaults compact format", () => {
    const a = parseArgv(["query", "f.md", "--table-id", "root-1"]);
    expect(a.command).toBe("query");
    expect(a.path).toBe("f.md");
    expect(a.format).toBe("compact");
    expect(a.tableId).toBe("root-1");
    expect(a.verbose).toBe(false);
  });

  it("parses catalog and query flags", () => {
    const c = parseArgv(["catalog", "docs", "--format", "json", "--follow-symlinks"]);
    expect(c.command).toBe("catalog");
    expect(c.path).toBe("docs");
    expect(c.format).toBe("json");
    expect(c.followSymlinks).toBe(true);
    const q = parseArgv([
      "query",
      "t.md",
      "--table",
      "Warehouse",
      "--select",
      "sku, qty",
      "--where-json",
      '{"loc":"us-east"}',
      "--gte",
      "qty=1",
      "--lte",
      "qty=9",
      "--gt",
      "qty=0",
      "--lt",
      "qty=10",
      "--contains",
      "sku=A-",
      "--limit",
      "5",
      "--max-tokens",
      "100",
      "--max-bytes",
      "400",
      "--cursor",
      "abc",
      "--verbose",
    ]);
    expect(q.select).toEqual(["sku", "qty"]);
    expect(q.gte).toEqual([{ col: "qty", n: 1 }]);
    expect(q.lte[0]?.n).toBe(9);
    expect(q.gt[0]?.n).toBe(0);
    expect(q.lt[0]?.n).toBe(10);
    expect(q.contains[0]?.substr).toBe("A-");
    expect(q.limit).toBe(5);
    expect(q.maxTokens).toBe(100);
    expect(q.maxBytes).toBe(400);
    expect(q.cursor).toBe("abc");
    expect(q.verbose).toBe(true);
  });

  it("help and version and -- rest", () => {
    expect(parseArgv(["--help"]).help).toBe(true);
    expect(parseArgv(["-V"]).version).toBe(true);
    expect(parseArgv(["help", "catalog"]).command).toBe("catalog");
    expect(parseArgv(["help", "catalog"]).help).toBe(true);
    const r = parseArgv(["query", "--", "weird.md"]);
    expect(r.path).toBe("weird.md");
  });

  it("usage errors", () => {
    expect(throwsUsage(() => parseArgv(["nope"]))).toContain("unknown command");
    expect(throwsUsage(() => parseArgv(["query", "a", "b"]))).toContain("extra");
    expect(throwsUsage(() => parseArgv(["query", "--bogus"]))).toContain("unknown option");
    expect(throwsUsage(() => parseArgv(["query", "--table"]))).toContain("missing value");
    expect(throwsUsage(() => parseArgv(["query", "--format", "xml"]))).toContain("unknown --format");
    expect(throwsUsage(() => parseArgv(["query", "--select", ","]))).toContain("at least one");
    expect(throwsUsage(() => parseArgv(["query", "--limit", "-1"]))).toContain("non-negative");
    expect(throwsUsage(() => parseArgv(["query", "--max-tokens", "x"]))).toContain("non-negative");
    expect(throwsUsage(() => parseArgv(["query", "--gte", "qty"]))).toContain("COL=VALUE");
    expect(throwsUsage(() => parseArgv(["query", "--gte", "=1"]))).toContain("COL=VALUE");
    expect(throwsUsage(() => parseArgv(["query", "--gte", "qty=nope"]))).toContain("COL=number");
    expect(throwsUsage(() => parseArgv(["query", "--contains", "sku"]))).toContain("COL=VALUE");
  });
});
