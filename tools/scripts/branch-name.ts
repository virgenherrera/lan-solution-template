/**
 * PR source branch validator (REQ-VERSION-02).
 *
 *   major/<slug>  -> major     minor/<slug> -> minor     fix/<slug> -> patch
 *   docs/<slug>, chore/<slug>  -> none (explicit exemption: no release)
 * Any other name, including `main`, is rejected (exit 1). A slug is lowercase letters,
 * digits and single hyphens.
 *
 * Usage:
 *   node tools/scripts/branch-name.ts [<branch>]   defaults to the current git branch
 * Prints `<branch> bump=<major|minor|patch|none>` on success.
 */

import { spawnSync } from "node:child_process";

const BUMPS: Readonly<Record<string, string>> = {
  major: "major",
  minor: "minor",
  fix: "patch",
  docs: "none",
  chore: "none",
};
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function currentBranch(): string {
  const result = spawnSync("git", ["branch", "--show-current"], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write("branch-name: cannot read the current git branch\n");
    process.exit(2);
  }
  return result.stdout.trim();
}

const args = process.argv.slice(2);
if (args.length > 1) {
  process.stderr.write("usage: node tools/scripts/branch-name.ts [<branch>]\n");
  process.exit(2);
}
const branch = args[0] ?? currentBranch();
const [prefix, slug, ...extra] = branch.split("/");
const bump = prefix !== undefined && Object.hasOwn(BUMPS, prefix) ? BUMPS[prefix] : undefined;

if (bump === undefined || slug === undefined || extra.length > 0 || !SLUG.test(slug)) {
  process.stderr.write(
    `branch-name: "${branch}" is invalid; expected <${Object.keys(BUMPS).join("|")}>/<slug> (lowercase, digits, hyphens)\n`,
  );
  process.exit(1);
}
process.stdout.write(`${branch} bump=${bump}\n`);
