import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ENGINES, manifestSchema } from 'db-migrations';
import { jsonText } from 'service-registry';
import { z } from 'zod';
import { RepoRoot } from './repo-root.service.js';

// Separator emitted by drizzle-kit between statements (S8).
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';
// Exact semver (optionally pre-release/build); anything with ^ ~ or a range operator fails.
const EXACT_VERSION =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

// Asset names: "db-migrations/<engine>/manifest.json", "db-migrations/<engine>/build-info.json" and "db-migrations/<engine>/<tag>.sql".
export const MANIFEST_FILE = 'manifest.json';
export const BUILD_INFO_FILE = 'build-info.json';
const MIGRATIONS_ASSET_DIR = 'db-migrations';

// Only the fields this service reads; files owned by other tools stay loose, the pin table is ours and stays strict.
const packageSchema = z.looseObject({
  name: z.string().optional(),
  version: z.string().optional(),
});
const devDependenciesSchema = z.looseObject({
  devDependencies: z.record(z.string(), z.string()).optional(),
});
const journalSchema = z.looseObject({
  entries: z.array(z.looseObject({ idx: z.number(), tag: z.string() })),
});
const vectorTableSchema = z.strictObject({
  library: z.string(),
  version: z.string(),
  source: z.string(),
  platforms: z.record(z.string(), z.unknown()),
  unavailable: z.array(z.string()),
});

interface PackedEntry {
  id: number;
  tag: string;
  file: string;
  sha256: string;
}

interface BuildInfo {
  drizzle_version: string;
}

// Packs the generated SQL migrations for the SEA (S7, S8): reads libs/db-migrations/<engine>/migrations (journal order) and writes dist/db-migrations/<engine>/{manifest.json,build-info.json,<tag>.sql}.
// Only the SQL and the two JSON files travel in the SEA; Drizzle never does. The SEA assembler shares the asset names below.
@Injectable()
export class MigrationPackService {
  constructor(private readonly repo: RepoRoot) {}

  get packOutDir(): string {
    return join(this.repo.path, 'dist', 'db-migrations');
  }

  packOutDirFor(engine: string): string {
    return join(this.packOutDir, engine);
  }

  manifestAssetName(engine: string): string {
    return `${MIGRATIONS_ASSET_DIR}/${engine}/${MANIFEST_FILE}`;
  }

  buildInfoAssetName(engine: string): string {
    return `${MIGRATIONS_ASSET_DIR}/${engine}/${BUILD_INFO_FILE}`;
  }

  migrationAssetName(engine: string, file: string): string {
    return `${MIGRATIONS_ASSET_DIR}/${engine}/${file}`;
  }

  // Without a requested engine it packs every engine the db-migrations contract lists; there is no implicit single engine.
  pack(requested: string | undefined): void {
    const generator = this.drizzleKit();
    const sqlite = this.readJson(
      join(this.repo.path, 'tools', 'vector', 'sqlite-vector-1.1.2.json'),
      vectorTableSchema,
    );
    const buildInfo = {
      runtime_version: this.packageVersion('apps/sea-runtime'),
      gateway_version: this.packageVersion('apps/api-gateway'),
      web_version: this.packageVersion('apps/web-angular'),
      vector_lib_version: this.exact(
        sqlite.library,
        sqlite.version,
        'tools/vector/sqlite-vector-1.1.2.json',
      ),
      drizzle_version: generator,
    };
    for (const engine of this.engines(requested))
      this.writeEngine(engine, buildInfo);
  }

  private get libDir(): string {
    return join(this.repo.path, 'libs', 'db-migrations');
  }

  private migrationsDirFor(engine: string): string {
    return join(this.libDir, engine, 'migrations');
  }

  private fail(message: string): never {
    throw new Error(message);
  }

  private engines(requested: string | undefined): readonly string[] {
    const known: readonly string[] = ENGINES;
    if (requested === undefined) return known;
    return known.includes(requested)
      ? [requested]
      : this.fail(`unknown engine "${requested}" (known: ${known.join(', ')})`);
  }

  private readJson<S extends z.ZodType>(path: string, schema: S): z.output<S> {
    const parsed = jsonText(schema).safeParse(readFileSync(path, 'utf8'));
    if (!parsed.success) this.fail(`${path}: ${z.prettifyError(parsed.error)}`);
    return parsed.data;
  }

  private exact(
    name: string,
    version: string | undefined,
    where: string,
  ): string {
    if (version === undefined || !EXACT_VERSION.test(version)) {
      this.fail(
        `${where}: "${name}" version "${version ?? ''}" is not an exact version (no ^, ~ or range)`,
      );
    }
    return `${name}@${version}`;
  }

  private packageVersion(relativeDir: string): string {
    const path = join(this.repo.path, relativeDir, 'package.json');
    const pkg = this.readJson(path, packageSchema);
    return this.exact(
      pkg.name ?? this.fail(`${path}: no name`),
      pkg.version,
      path,
    );
  }

  // drizzle-kit as pinned for the library: a literal devDependency, or a `catalog:` reference whose version the lockfile resolves to the installed copy.
  private drizzleKit(): string {
    const path = join(this.libDir, 'package.json');
    const spec = this.readJson(path, devDependenciesSchema).devDependencies?.[
      'drizzle-kit'
    ];
    const installedPath = join(
      this.libDir,
      'node_modules',
      'drizzle-kit',
      'package.json',
    );
    const installed = existsSync(installedPath)
      ? this.readJson(installedPath, packageSchema).version
      : undefined;
    if (spec?.startsWith('catalog:'))
      return this.exact(
        'drizzle-kit',
        installed ?? this.fail(`${installedPath}: run \`pnpm install\` first`),
        installedPath,
      );
    if (installed !== undefined && installed !== spec)
      this.fail(
        `${installedPath}: installed drizzle-kit ${installed} differs from the pin ${spec}`,
      );
    return this.exact('drizzle-kit', spec, path);
  }

  // A file with several statements needs the drizzle-kit marker; a plain file may hold one statement only.
  private assertStatements(file: string, text: string): void {
    if (text.includes(STATEMENT_BREAKPOINT)) return;
    const statements = text
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .filter((part) => part.trim() !== '');
    if (statements.length > 1) {
      this.fail(
        `${file}: ${statements.length} statements without the "${STATEMENT_BREAKPOINT}" marker`,
      );
    }
  }

  private readEntries(engine: string): PackedEntry[] {
    const migrationsDir = this.migrationsDirFor(engine);
    const journalPath = join(migrationsDir, 'meta', '_journal.json');
    const journal = this.readJson(journalPath, journalSchema);
    const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);
    entries.forEach((entry, position) => {
      if (entry.idx !== position)
        this.fail(
          `${journalPath}: journal gap, expected idx ${position}, found ${entry.idx}`,
        );
    });
    const listed = new Set(entries.map((entry) => `${entry.tag}.sql`));
    const stray = readdirSync(migrationsDir).filter(
      (name) => name.endsWith('.sql') && !listed.has(name),
    );
    if (stray.length > 0)
      this.fail(
        `${migrationsDir}: .sql files outside the journal: ${stray.join(', ')}`,
      );
    return entries.map((entry) => {
      const file = `${entry.tag}.sql`;
      const path = join(migrationsDir, file);
      if (!existsSync(path))
        this.fail(`${path}: listed in the journal but missing`);
      const text = readFileSync(path, 'utf8');
      this.assertStatements(file, text);
      return {
        id: entry.idx,
        tag: entry.tag,
        file,
        sha256: createHash('sha256').update(text).digest('hex'),
      };
    });
  }

  private writeEngine(engine: string, buildInfo: BuildInfo): void {
    const { drizzle_version: generator } = buildInfo;
    const entries = this.readEntries(engine);
    const manifest = manifestSchema.parse({
      engine,
      generator,
      migrations: entries,
    });
    const outDir = this.packOutDirFor(engine);
    // Start clean so a tag removed from the journal cannot linger as a stale .sql.
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    for (const entry of entries)
      copyFileSync(
        join(this.migrationsDirFor(engine), entry.file),
        join(outDir, entry.file),
      );
    writeFileSync(
      join(outDir, MANIFEST_FILE),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    writeFileSync(
      join(outDir, BUILD_INFO_FILE),
      `${JSON.stringify(buildInfo, null, 2)}\n`,
    );
    process.stdout.write(
      `packed ${manifest.migrations.length} migration(s) for ${engine}, generator ${generator}, into ${outDir}\n`,
    );
  }
}
