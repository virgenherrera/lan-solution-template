/**
 * Test selection adapter for the root `test` script (REQ-TEST-02, REQ-TEST-03, REQ-ECO-04).
 *
 * Optional selection tags. A tag never changes the runner, the bootstrap or the environment:
 *   @ut   selects behaviors observable through the real app.
 *   @int  selects interactions between real components.
 *   @app  selects the complete APP suite; untagged cases are also APP.
 *
 * Usage (pnpm appends the arguments after `--`):
 *   pnpm test                          all cases
 *   pnpm test -- --filter @ut|@int|@app
 *
 * The adapter is the first step of `test`: it validates the filter before anything runs,
 * then runs securityCheck and the Nx test fan-out. The filter never reaches Nx or pnpm.
 * Prints the runner arguments as JSON: { "jest": [...], "playwright": [...] }.
 * Jest receives --testNamePattern and Playwright receives --grep.
 * Unknown tags, an empty tag and any other argument exit with code 2 before any step runs.
 */

import { spawnSync } from "node:child_process";

const TAGS: readonly string[] = ["@ut", "@int", "@app"];
const USAGE = "usage: node tools/scripts/test-filter.ts [-- --filter @ut|@int|@app]";

function fail(message: string): never {
  process.stderr.write(`test-filter: ${message}\n${USAGE}\n`);
  process.exit(2);
}

function parseTag(argv: readonly string[]): string | undefined {
  // pnpm forwards the arguments after `--` and keeps that separator in argv.
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  if (args.length === 0) {
    return undefined;
  }
  if (args.length !== 2 || args[0] !== "--filter") {
    fail(`unsupported arguments: ${args.join(" ")}`);
  }
  const tag = args[1] ?? "";
  if (tag.trim() === "") {
    fail("--filter requires a non-empty tag");
  }
  if (!TAGS.includes(tag)) {
    fail(`unknown filter "${tag}"; expected one of ${TAGS.join(", ")}`);
  }
  return tag;
}

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, [...args], { stdio: "inherit", shell: false });
  if (result.error !== undefined) {
    process.stderr.write(`test-filter: ${command} failed to start: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const tag = parseTag(process.argv.slice(2));
// @app is the complete suite, so it adds no pattern.
const selects = tag !== undefined && tag !== "@app";
const translation = {
  jest: selects ? ["--testNamePattern", tag] : [],
  playwright: selects ? ["--grep", tag] : [],
};

process.stdout.write(`${JSON.stringify(translation)}\n`);

// Static and security checks always run, whatever the filter selected.
run("pnpm", ["run", "securityCheck"]);
// The translated runner arguments are not consumed yet: no APP tests exist for them to select.
run("pnpm", ["exec", "nx", "run-many", "-t", "test", "--exclude=lan-solution-template"]);
