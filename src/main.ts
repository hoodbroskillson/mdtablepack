import { AppError, EXIT } from "mdtableops";
import {
  commandHelp,
  parseArgv,
  requireFile,
  requirePath,
  HELP_MAIN,
  type ParsedArgs,
} from "./argv.js";
import { catalogPath, renderCatalogCompact, renderCatalogJson } from "./catalog.js";
import { formatError } from "./errors.js";
import { stderrMoreLine } from "./format.js";
import { queryFile } from "./query.js";
import { ESTIMATOR_NOTE, estimateTokens, savedPct, utf8Bytes } from "./tokens.js";
import { VERSION } from "./version.js";

export interface Io {
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

function writeLine(stream: NodeJS.WritableStream, text: string): void {
  const body = text.endsWith("\n") ? text : `${text}\n`;
  stream.write(body);
}

function writeVerbose(io: Io, originalTokens: number, returnedText: string): void {
  const returnedTokens = estimateTokens(utf8Bytes(returnedText.endsWith("\n") ? returnedText : `${returnedText}\n`));
  const pct = savedPct(originalTokens, returnedTokens);
  io.stderr.write(
    `mdtablepack: originalTokens=${originalTokens} returnedTokens=${returnedTokens} pctSaved=${pct} (${ESTIMATOR_NOTE})\n`,
  );
}

export async function run(argv: string[], io: Io = process): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgv(argv);
  } catch (err) {
    return fail(err, io);
  }

  if (args.version && !args.command) {
    writeLine(io.stdout, VERSION);
    return EXIT.ok;
  }
  if (args.help && !args.command) {
    io.stdout.write(HELP_MAIN);
    return EXIT.ok;
  }
  if (args.help && args.command) {
    io.stdout.write(commandHelp(args.command));
    return EXIT.ok;
  }
  if (!args.command) {
    io.stderr.write(HELP_MAIN);
    return EXIT.usage;
  }

  try {
    switch (args.command) {
      case "catalog": {
        if (args.format !== "compact" && args.format !== "json") {
          throw new AppError("catalog --format must be compact or json", EXIT.usage);
        }
        const root = requirePath(args);
        const tables = await catalogPath(root, args.followSymlinks);
        const text = args.format === "json" ? renderCatalogJson(tables) : renderCatalogCompact(tables);
        writeLine(io.stdout, text);
        if (args.verbose) {
          const original = tables.reduce((a, t) => a + t.estimatedTokens, 0);
          writeVerbose(io, original, text);
        }
        return EXIT.ok;
      }
      case "query": {
        const file = requireFile(args);
        const packed = await queryFile(file, args.followSymlinks, {
          table: args.table,
          tableId: args.tableId,
          select: args.select,
          whereJson: args.whereJson,
          gte: args.gte,
          lte: args.lte,
          gt: args.gt,
          lt: args.lt,
          contains: args.contains,
          limit: args.limit,
          maxTokens: args.maxTokens,
          maxBytes: args.maxBytes,
          cursor: args.cursor,
          format: args.format,
        });
        writeLine(io.stdout, packed.text);
        if (args.format === "tsv" || args.format === "markdown") {
          const extra = stderrMoreLine(packed.more, packed.cursor, packed.n);
          if (extra) writeLine(io.stderr, extra);
        }
        if (args.verbose) writeVerbose(io, packed.originalTokens, packed.text);
        return EXIT.ok;
      }
      default:
        throw new AppError("unknown command", EXIT.usage);
    }
  } catch (err) {
    return fail(err, io);
  }
}

function fail(err: unknown, io: Io): number {
  if (err instanceof AppError) {
    writeLine(io.stderr, formatError(err));
    return err.exitCode;
  }
  const message = err instanceof Error ? err.message : String(err);
  writeLine(io.stderr, `mdtablepack: ${message}`);
  return EXIT.error;
}
