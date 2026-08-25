import { AppError, EXIT } from "mdtableops";

export function usage(message: string): AppError {
  return new AppError(message, EXIT.usage);
}

export function formatError(err: AppError): string {
  const bits: string[] = [];
  if (err.details.file) bits.push(`file: ${err.details.file}`);
  if (err.details.table) bits.push(`table: ${err.details.table}`);
  if (err.details.column) bits.push(`column: ${err.details.column}`);
  if (err.details.line !== undefined) bits.push(`line: ${err.details.line}`);
  const suffix = bits.length ? ` (${bits.join(", ")})` : "";
  return `mdtablepack: ${err.message}${suffix}`;
}
