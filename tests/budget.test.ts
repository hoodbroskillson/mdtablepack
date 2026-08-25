import { describe, expect, it } from "vitest";
import { exceedsBudget, fitRowCount } from "../src/budget.js";

describe("budget", () => {
  it("exceedsBudget", () => {
    expect(exceedsBudget("abcd", undefined, undefined)).toBe(false);
    expect(exceedsBudget("abcd", 1, undefined)).toBe(false);
    expect(exceedsBudget("abcde", 1, undefined)).toBe(true);
    expect(exceedsBudget("abcd", undefined, 3)).toBe(true);
    expect(exceedsBudget("abcd", undefined, 4)).toBe(false);
  });

  it("fitRowCount accepts header even when it exceeds", () => {
    const render = (n: number) => "H".repeat(20) + "R".repeat(n * 10);
    expect(fitRowCount(5, 0, 5, (n, _m, _o) => render(n), 1, undefined)).toBe(0);
  });

  it("never splits: largest whole-row prefix", () => {
    const render = (n: number) => "x".repeat(n * 8);
    expect(fitRowCount(5, 0, 5, (n) => render(n), undefined, 20)).toBe(2);
    expect(fitRowCount(5, 0, 5, (n) => render(n), undefined, 40)).toBe(5);
    expect(fitRowCount(0, 0, 0, (n) => render(n), 1, 1)).toBe(0);
  });

  it("all-fit path when no budget", () => {
    expect(fitRowCount(7, 0, 7, (n) => String(n), undefined, undefined)).toBe(7);
  });
});
