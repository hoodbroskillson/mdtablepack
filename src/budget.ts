import { estimateTokens, utf8Bytes } from "./tokens.js";

export function exceedsBudget(
  text: string,
  maxTokens: number | undefined,
  maxBytes: number | undefined,
): boolean {
  if (maxTokens === undefined && maxBytes === undefined) return false;
  const bytes = utf8Bytes(text);
  if (maxBytes !== undefined && bytes > maxBytes) return true;
  if (maxTokens !== undefined && estimateTokens(bytes) > maxTokens) return true;
  return false;
}

/**
 * Largest n such that render(n) does not exceed budget.
 * Header (n=0) is always accepted even if it exceeds (metadata may exceed).
 *
 * `totalFiltered` is the full filtered row count; `start` is the cursor offset
 * into that list; `page` is the already-sliced page (after offset+limit).
 */
export function fitRowCount(
  pageLength: number,
  start: number,
  totalFiltered: number,
  render: (n: number, more: boolean, nextOffset: number) => string,
  maxTokens: number | undefined,
  maxBytes: number | undefined,
): number {
  if (pageLength <= 0) return 0;
  if (maxTokens === undefined && maxBytes === undefined) return pageLength;

  const moreIfAll = start + pageLength < totalFiltered;
  const allText = render(pageLength, moreIfAll, start + pageLength);
  if (!exceedsBudget(allText, maxTokens, maxBytes)) return pageLength;

  // Truncation: any prefix has more=true relative to totalFiltered as long as
  // n < pageLength or moreIfAll (start+n < totalFiltered is true for n < pageLength
  // when we already know all of page does not fit... actually if page is the
  // last page but still exceeds, prefixes have more=true because remaining
  // rows of the page were not emitted, and those rows exist in totalFiltered.)
  // start + n < totalFiltered for n < pageLength if start+pageLength <= totalFiltered
  // (always: page is a slice of remaining). start+pageLength <= totalFiltered always.
  // For n < pageLength, start+n < start+pageLength <= totalFiltered, so more=true.
  let lo = 0;
  let hi = pageLength - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const more = start + mid < totalFiltered;
    const text = render(mid, more, start + mid);
    if (exceedsBudget(text, maxTokens, maxBytes)) {
      hi = mid - 1;
    } else {
      lo = mid;
    }
  }
  if (lo > 0) {
    const more = start + lo < totalFiltered;
    const text = render(lo, more, start + lo);
    if (exceedsBudget(text, maxTokens, maxBytes)) return 0;
  }
  return lo;
}
