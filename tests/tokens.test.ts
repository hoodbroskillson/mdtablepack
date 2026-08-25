import { describe, expect, it } from "vitest";
import { estimateTokens, savedPct, utf8Bytes } from "../src/tokens.js";

describe("tokens", () => {
  it("ceil utf8 bytes / 4", () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(-1)).toBe(0);
    expect(estimateTokens(1)).toBe(1);
    expect(estimateTokens(4)).toBe(1);
    expect(estimateTokens(5)).toBe(2);
    expect(estimateTokens("abcd")).toBe(1);
    expect(utf8Bytes("é")).toBe(2);
    expect(estimateTokens("é")).toBe(1);
    expect(estimateTokens(Buffer.from("hi"))).toBe(1);
  });

  it("savedPct", () => {
    expect(savedPct(0, 10)).toBe(0);
    expect(savedPct(100, 40)).toBe(60);
    expect(savedPct(100, 150)).toBe(-50);
  });
});
