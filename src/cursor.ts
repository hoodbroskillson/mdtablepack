import { AppError, EXIT } from "mdtableops";

export interface CursorPayload {
  hash: string;
  offset: number;
}

export function encodeCursor(hash: string, offset: number): string {
  const json = JSON.stringify({ hash, offset });
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(raw: string): CursorPayload {
  let json: string;
  try {
    json = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new AppError("invalid cursor", EXIT.usage);
  }
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    throw new AppError("invalid cursor", EXIT.usage);
  }
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new AppError("invalid cursor", EXIT.usage);
  }
  const obj = v as { hash?: unknown; offset?: unknown };
  if (typeof obj.hash !== "string" || obj.hash.length === 0) {
    throw new AppError("invalid cursor", EXIT.usage);
  }
  if (typeof obj.offset !== "number" || !Number.isInteger(obj.offset) || obj.offset < 0) {
    throw new AppError("invalid cursor", EXIT.usage);
  }
  return { hash: obj.hash, offset: obj.offset };
}

export function assertCursorHash(payload: CursorPayload, tableHash: string, file: string, tableId: string): void {
  if (payload.hash !== tableHash) {
    throw new AppError(
      `stale cursor: table hash changed (cursor ${payload.hash}, actual ${tableHash})`,
      EXIT.hashMismatch,
      { file, table: tableId },
    );
  }
}
