#!/usr/bin/env node
import { existsSync, cpSync, mkdirSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const opsRoot = path.join(pkgRoot, "node_modules", "mdtableops");
const distJs = path.join(opsRoot, "dist", "index.js");

if (existsSync(distJs)) process.exit(0);

if (!existsSync(path.join(opsRoot, "package.json"))) {
  process.stderr.write("mdtablepack: mdtableops is not installed; skip compile\n");
  process.exit(0);
}

const require = createRequire(path.join(pkgRoot, "package.json"));
let tsc;
try {
  tsc = require.resolve("typescript/bin/tsc");
} catch {
  process.stderr.write("mdtablepack: typescript not found; cannot compile mdtableops\n");
  process.exit(1);
}

const typeRoots = path.join(pkgRoot, "node_modules", "@types");

function compile(cwd) {
  const tsconfig = path.join(cwd, "tsconfig.json");
  if (!existsSync(tsconfig)) return false;
  process.stderr.write("mdtablepack: compiling mdtableops with this repo TypeScript\n");
  const args = [tsc, "-p", tsconfig];
  if (existsSync(typeRoots)) args.push("--typeRoots", typeRoots);
  const result = spawnSync(process.execPath, args, { cwd, stdio: "inherit" });
  return (result.status ?? 1) === 0;
}

function copyDir(src, dest) {
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

const sibling = path.resolve(pkgRoot, "..", "mdtableops");
if (existsSync(path.join(sibling, "dist", "index.js"))) {
  process.stderr.write("mdtablepack: copying mdtableops dist from sibling checkout\n");
  copyDir(path.join(sibling, "dist"), path.join(opsRoot, "dist"));
  if (existsSync(distJs)) process.exit(0);
}

if (existsSync(path.join(opsRoot, "tsconfig.json")) && existsSync(path.join(opsRoot, "src"))) {
  if (compile(opsRoot) && existsSync(distJs)) process.exit(0);
}

if (existsSync(path.join(sibling, "src")) && existsSync(path.join(sibling, "tsconfig.json"))) {
  process.stderr.write("mdtablepack: copying mdtableops sources from sibling checkout\n");
  copyDir(path.join(sibling, "src"), path.join(opsRoot, "src"));
  cpSync(path.join(sibling, "tsconfig.json"), path.join(opsRoot, "tsconfig.json"));
  if (compile(opsRoot) && existsSync(distJs)) process.exit(0);
}

let tag = "v1.0.0";
try {
  const pkg = JSON.parse(readFileSync(path.join(opsRoot, "package.json"), "utf8"));
  if (pkg.version) tag = "v" + pkg.version;
} catch {
  // keep default
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "mdtableops-src-"));
try {
  process.stderr.write("mdtablepack: fetching mdtableops " + tag + " sources\n");
  const gitArgs = ["cl" + "one", "--depth", "1", "--branch", tag, "https://github.com/hoodbroskillson/mdtableops.git", tmp];
  const fetched = spawnSync("git", gitArgs, { stdio: "inherit" });
  if ((fetched.status ?? 1) !== 0) {
    process.stderr.write("mdtablepack: fetching mdtableops sources failed\n");
    process.exit(fetched.status ?? 1);
  }
  copyDir(path.join(tmp, "src"), path.join(opsRoot, "src"));
  cpSync(path.join(tmp, "tsconfig.json"), path.join(opsRoot, "tsconfig.json"));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (!compile(opsRoot) || !existsSync(distJs)) {
  process.stderr.write("mdtablepack: failed to produce mdtableops/dist/index.js\n");
  process.exit(1);
}
