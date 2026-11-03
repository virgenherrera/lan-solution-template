// Creates the dev config from the shipped example, only when it is absent. Usage: `pnpm run dev:config`.
// An existing file is never overwritten; it is only validated. Needs the built shared-core library.
// Root selection matches a dev launch: --root, APP_HOME, then <repo>/.local.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..', '..');
const shared = join(repo, 'libs', 'shared-core');
const { CONFIG_FILE, configSchema } = (await import(join(shared, 'dist', 'config.js'))) as typeof import('../../libs/shared-core/dist/config.js');
const { derivePaths, resolveRoot } = (await import(join(shared, 'dist', 'paths.js'))) as typeof import('../../libs/shared-core/dist/paths.js');

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Same checks as the app startup, so a file accepted here is accepted there.
function validate(file: string, text: string): void {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    fail(`config ${file} is not valid JSON: ${(error as Error).message}`);
  }
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) fail(`config ${file} is invalid: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ')}`);
}

const resolved = resolveRoot({
  argv: process.argv.slice(2),
  env: process.env,
  execPath: process.execPath,
  platform: process.platform,
  devAnchor: join(repo, '.local'),
});
const { configDir } = derivePaths(resolved, process.execPath);
const target = join(configDir, CONFIG_FILE);

if (existsSync(target)) {
  validate(target, readFileSync(target, 'utf8'));
  console.log(`config exists and is valid: ${target}`);
} else {
  const example = join(shared, 'config.example.json');
  const text = readFileSync(example, 'utf8');
  validate(example, text);
  mkdirSync(dirname(target), { recursive: true });
  // The wx flag makes a concurrent creation fail instead of overwriting.
  writeFileSync(target, text, { flag: 'wx' });
  console.log(`config created: ${target}`);
}
