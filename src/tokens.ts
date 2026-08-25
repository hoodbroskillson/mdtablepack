/** Default estimator: ceil(utf8_bytes / 4). Not a provider tokenizer. */
export const TOKENS_PER_BYTE = 4;

export function utf8Bytes(s: string | Uint8Array): number {
  if (typeof s === "string") return Buffer.byteLength(s, "utf8");
  return s.byteLength;
}

export function estimateTokens(bytesOrText: number | string | Uint8Array): number {
  const n = typeof bytesOrText === "number" ? bytesOrText : utf8Bytes(bytesOrText);
  if (n <= 0) return 0;
  return Math.ceil(n / TOKENS_PER_BYTE);
}

export function savedPct(originalTokens: number, returnedTokens: number): number {
  if (originalTokens <= 0) return 0;
  return Math.round((1 - returnedTokens / originalTokens) * 100);
}

export const ESTIMATOR_NOTE = "estimate: ceil(utf8_bytes / 4); not tiktoken / not provider-exact";
