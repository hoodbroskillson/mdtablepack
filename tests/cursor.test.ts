import { describe, expect, it } from "vitest";
import { AppError, EXIT } from "mdtableops";
import { assertCursorHash, decodeCursor, encodeCursor } from "../src/cursor.js";

describe("cursor", () => {
  it("roundtrips", () => {
    const c = encodeCursor("abc", 3);
    expect(c).not.toMatch(/[+/=]/);
    expect(decodeCursor(c)).toEqual({ hash: "abc", offset: 3 });
  });

  it("refuses invalid", () => {
    expect(() => decodeCursor("!!!")).toThrow(AppError);
    expect(() => decodeCursor(Buffer.from("[]").toString("base64url"))).toThrow(AppError);
    expect(() => decodeCursor(Buffer.from("{}").toString("base64url"))).toThrow(AppError);
    expect(() => decodeCursor(Buffer.from('{"hash":"x","offset":-1}').toString("base64url"))).toThrow(AppError);
    expect(() => decodeCursor(Buffer.from('{"hash":"x","offset":1.5}').toString("base64url"))).toThrow(AppError);
    try {
      decodeCursor("ZZZZ");
    } catch (err) {
      expect((err as AppError).exitCode).toBe(EXIT.usage);
    }
  });

  it("stale hash is exit 5", () => {
    try {
      assertCursorHash({ hash: "aa", offset: 0 }, "bb", "f.md", "root-1");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).exitCode).toBe(EXIT.hashMismatch);
    }
  });
});
