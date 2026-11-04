/**
 * Lockstep version check (REQ-VERSION-01, REQ-VERSION-03).
 *
 * Reads the version of every workspace `package.json`, `apps/desktop/src-tauri/Cargo.toml`,
 * the `app` entry of `Cargo.lock` and `tauri.conf.json`, prints one line per place and
 * exits 1 when they are not all the same. The root `package.json` is the source of truth.
 *
 * Usage: node tools/scripts/version-check.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TAURI = "apps/desktop/src-tauri";

function readJsonVersion(path: string): string {
  return (JSON.parse(readFileSync(path, "utf8")) as { version: string }).version;
}

function tomlVersion(text: string, anchor: RegExp): string {
  const match = anchor.exec(text);
  const rest = match === null ? "" : text.slice(match.index + match[0].length);
  return /^version = "([^"]*)"/m.exec(rest)?.[1] ?? "missing";
}

const found = new Map<string, string>();
found.set("package.json", readJsonVersion("package.json"));
for (const group of ["apps", "libs"]) {
  for (const entry of readdirSync(group, { withFileTypes: true })) {
    const path = join(group, entry.name, "package.json");
    if (entry.isDirectory()) {
      found.set(path, readJsonVersion(path));
    }
  }
}
const cargo = readFileSync(join(TAURI, "Cargo.toml"), "utf8");
const crate = /^\[package\][\s\S]*?^name = "([^"]+)"/m.exec(cargo)?.[1] ?? "";
found.set(join(TAURI, "Cargo.toml"), tomlVersion(cargo, /^\[package\]\s*$/m));
found.set(
  join(TAURI, "Cargo.lock"),
  tomlVersion(readFileSync(join(TAURI, "Cargo.lock"), "utf8"), new RegExp(`^name = "${crate}"\\s*$`, "m")),
);
found.set(join(TAURI, "tauri.conf.json"), readJsonVersion(join(TAURI, "tauri.conf.json")));

const expected = found.get("package.json");
let drift = 0;
for (const [path, version] of found) {
  const ok = version === expected;
  drift += ok ? 0 : 1;
  process.stdout.write(`${ok ? "ok  " : "DIFF"} ${version.padEnd(8)} ${path}\n`);
}
if (drift > 0) {
  process.stderr.write(`version-check: ${drift} place(s) differ from package.json (${expected})\n`);
  process.exit(1);
}
process.stdout.write(`version-check: all ${found.size} places at ${expected}\n`);
