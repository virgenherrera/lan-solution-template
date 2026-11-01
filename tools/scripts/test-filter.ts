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
 * Prints the runner arguments as JSON: { "jest": [...], "playwright": [...] }.
 * Jest receives --testNamePattern and Playwright receives --grep.
 * Unknown tags, an empty tag and any other argument exit with code 2.
 */

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

const tag = parseTag(process.argv.slice(2));
// @app is the complete suite, so it adds no pattern.
const selects = tag !== undefined && tag !== "@app";
const translation = {
  jest: selects ? ["--testNamePattern", tag] : [],
  playwright: selects ? ["--grep", tag] : [],
};

process.stdout.write(`${JSON.stringify(translation)}\n`);
