import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { manifestSchema } from 'db-migrations';
import { z } from 'zod';
import { BUILD_INFO_FILE, MANIFEST_FILE, MigrationPackService } from '../services/migration-pack.service.js';
import { readJson } from './json-file.js';
import { SeaPaths } from './sea-paths.service.js';
import { SeaTargetService, type BuildTarget } from './sea-target.service.js';
import { type WebBundle } from './sea-dependencies.service.js';

// The vector pin table is ours and stays strict.
const vectorTableSchema = z.strictObject({
  library: z.string(),
  version: z.string(),
  source: z.string(),
  platforms: z.record(
    z.string(),
    z.strictObject({ package: z.string(), tarball: z.string(), tarballIntegrity: z.string(), file: z.string(), librarySha256: z.string() }),
  ),
  unavailable: z.array(z.string()),
});

type Assets = Record<string, string>;

// The SEA assets the assembler embeds: the web bundle, the sqlite-vector variant of the target and the packed migrations. Each method returns "asset name -> file on disk".
@Injectable()
export class SeaAssetsService {
  constructor(
    private readonly paths: SeaPaths,
    private readonly targets: SeaTargetService,
    private readonly packer: MigrationPackService,
  ) {}

  // Every file of the web bundle becomes SEA asset "web/<relative path>"; the manifest (path to sha256) is written next to the bundle and embedded as "web-manifest.json".
  // No web bundle means no web assets and no manifest; the supervisor then passes no --web flag. With a bundle, the supervisor reads the files in memory (getRawAsset) and sends them to the gateway over IPC; nothing is extracted.
  web(web: WebBundle | undefined): Assets {
    if (web === undefined) return {};
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
    const files = walk(web.dir)
      .map((file) => file.slice(web.dir.length + 1).split('\\').join('/'))
      .sort();
    const hashes = Object.fromEntries(files.map((rel) => [rel, createHash('sha256').update(readFileSync(join(web.dir, rel))).digest('hex')]));
    writeFileSync(this.paths.webManifestPath, `${JSON.stringify({ files: hashes }, null, 2)}\n`);
    const assets: Assets = { 'web-manifest.json': this.paths.webManifestPath };
    for (const rel of files) assets[`web/${rel}`] = join(web.dir, rel);
    process.stdout.write(`web bundle ${web.name}: ${files.length} files from ${web.dir}\n`);
    return assets;
  }

  // The sqlite-vector variant of the target becomes SEA assets "sqlite-vector/<file>" and "sqlite-vector/pin.json" (names mirror libs/shared-core/src/db/sqlite/vector.ts).
  // The tarball comes from the pinned npm URL, is checked against the pinned sha512 integrity, and its binary against the pinned sha256. A platform without a pin fails the build.
  async vector(target: BuildTarget): Promise<Assets> {
    const table = readJson(this.paths.vectorTablePath, vectorTableSchema);
    const key = this.targets.vectorPlatformKey(target.triple);
    const entry = key === undefined ? undefined : table.platforms[key];
    if (key === undefined || entry === undefined) {
      throw new Error(`sqlite-vector ${table.version} has no pinned binary for ${target.triple}; unavailable upstream: ${table.unavailable.join(', ')}`);
    }
    const cacheDir = this.paths.vectorCacheDir;
    mkdirSync(cacheDir, { recursive: true });
    const tarball = join(cacheDir, `${key}-${table.version}.tgz`);
    const integrityOf = (file: string): string => `sha512-${createHash('sha512').update(readFileSync(file)).digest('base64')}`;
    if (!existsSync(tarball) || integrityOf(tarball) !== entry.tarballIntegrity) {
      const response = await fetch(entry.tarball);
      if (!response.ok) throw new Error(`download ${entry.tarball} failed: HTTP ${response.status}`);
      writeFileSync(tarball, Buffer.from(await response.arrayBuffer()));
    }
    if (integrityOf(tarball) !== entry.tarballIntegrity) throw new Error(`sqlite-vector tarball integrity mismatch for ${key}`);
    const extractDir = join(cacheDir, `${key}-${table.version}`);
    rmSync(extractDir, { recursive: true, force: true });
    mkdirSync(extractDir, { recursive: true });
    execFileSync('tar', ['-xzf', tarball, '-C', extractDir, `package/${entry.file}`]);
    const binary = join(extractDir, 'package', entry.file);
    const sha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
    if (sha256 !== entry.librarySha256) throw new Error(`sqlite-vector binary sha256 mismatch for ${key}: expected ${entry.librarySha256}, got ${sha256}`);
    writeFileSync(this.paths.vectorPinPath, `${JSON.stringify({ version: table.version, platform: key, file: entry.file, sha256 }, null, 2)}\n`);
    process.stdout.write(`sqlite-vector ${table.version}: ${key} ${entry.file} sha256 ${sha256}\n`);
    return { 'sqlite-vector/pin.json': this.paths.vectorPinPath, [`sqlite-vector/${entry.file}`]: binary };
  }

  // Every packed engine is embedded and the runtime reads only the selected one (pack-migrations ran before this step). Only SQL and JSON travel, never Drizzle (S7).
  migrations(): Assets {
    const packOut = this.packer.packOutDir;
    const engines = existsSync(packOut) ? readdirSync(packOut, { withFileTypes: true }).filter((entry) => entry.isDirectory()) : [];
    if (engines.length === 0) throw new Error(`${packOut}: no packed engine; run "tools-cli pack-migrations" first`);
    return Object.assign({}, ...engines.map((entry) => this.engineMigrations(entry.name)));
  }

  // The packed migrations become SEA assets "db-migrations/<engine>/manifest.json", "db-migrations/<engine>/build-info.json" and "db-migrations/<engine>/<tag>.sql".
  private engineMigrations(engine: string): Assets {
    const outDir = this.packer.packOutDirFor(engine);
    const manifestPath = join(outDir, MANIFEST_FILE);
    const buildInfoPath = join(outDir, BUILD_INFO_FILE);
    for (const path of [manifestPath, buildInfoPath]) {
      if (!existsSync(path)) throw new Error(`${path} missing; run "tools-cli pack-migrations --engine ${engine}" first`);
    }
    const { migrations, engine: packedEngine } = readJson(manifestPath, manifestSchema);
    if (packedEngine !== engine) throw new Error(`${manifestPath}: packed for engine "${packedEngine}", expected "${engine}"`);
    const assets: Assets = { [this.packer.manifestAssetName(engine)]: manifestPath, [this.packer.buildInfoAssetName(engine)]: buildInfoPath };
    for (const { file, sha256 } of migrations) {
      const path = join(outDir, file);
      if (!existsSync(path) || createHash('sha256').update(readFileSync(path, 'utf8')).digest('hex') !== sha256) {
        throw new Error(`${path}: missing or differs from the packed manifest; run "tools-cli pack-migrations --engine ${engine}" again`);
      }
      assets[this.packer.migrationAssetName(engine, file)] = path;
    }
    process.stdout.write(`db migrations (${engine}): ${migrations.length} sql file(s) plus manifest and build info\n`);
    return assets;
  }
}
