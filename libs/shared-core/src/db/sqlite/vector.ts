import { createHash } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { jsonText } from 'service-registry';
import { z } from 'zod';
import { VectorUnavailableError, type VectorMatch } from '../port.js';
import type { SqliteVectorBackend } from './adapter.js';

// REQ-DB-08 and REQ-DB-09. The sqlite-vector library (sqliteai, https://github.com/sqliteai/sqlite-vector, NOT sqlite-vec) travels as SEA assets.
// compile-sea embeds exactly one variant: the binary "sqlite-vector/<file>" and its pin "sqlite-vector/pin.json". These names mirror tools/scripts/compile-sea.ts.
export const VECTOR_PIN_ASSET = 'sqlite-vector/pin.json';
export const VECTOR_BINARY_ASSET_PREFIX = 'sqlite-vector/';

// Reads one embedded asset; matches `getAsset` of node:sea called without an encoding.
export type AssetReader = (name: string) => ArrayBuffer | Uint8Array | undefined;

// Pin of the embedded variant. It comes from the versioned table tools/vector/sqlite-vector-<version>.json, filtered by compile-sea to the target platform.
const pinSchema = z.object({
  version: z.string().min(1),
  platform: z.string().min(1),
  file: z.string().regex(/^vector\.(dylib|so|dll)$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type VectorPin = z.infer<typeof pinSchema>;

// "<platform>-<arch>" plus the C library on Linux, the same keys as the pin table. Only the variant matching this key is ever loaded.
export function currentPlatformKey(): string {
  const base = `${process.platform}-${process.arch}`;
  if (process.platform !== 'linux') return base;
  const header = (process.report.getReport() as { header: { glibcVersionRuntime?: string } }).header;
  return `${base}-${header.glibcVersionRuntime === undefined ? 'musl' : 'glibc'}`;
}

const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function readAsset(getAsset: AssetReader, name: string): Uint8Array {
  const asset = getAsset(name);
  if (asset === undefined) throw new VectorUnavailableError(`SEA asset "${name}" is missing`);
  return asset instanceof Uint8Array ? asset : new Uint8Array(asset);
}

function parsePin(getAsset: AssetReader): VectorPin {
  const text = Buffer.from(readAsset(getAsset, VECTOR_PIN_ASSET)).toString('utf8');
  const parsed = jsonText(pinSchema).safeParse(text);
  if (!parsed.success) throw new VectorUnavailableError(`invalid ${VECTOR_PIN_ASSET}: ${parsed.error.message}`);
  return parsed.data;
}

// Writes the embedded library to a real file (loadExtension needs one; SEA useVfs is off) and returns its path.
// The bytes are checked against the pinned sha256 before they reach the disk and again after the write. A mismatch throws; there is no fallback.
// The file lives in <directory>/<sha256 prefix>/ so two versions never collide; the directory is 0700 and the file 0600.
export function extractVectorLibrary(getAsset: AssetReader, directory: string, platformKey: string = currentPlatformKey()): string {
  const pin = parsePin(getAsset);
  if (pin.platform !== platformKey) {
    throw new VectorUnavailableError(`embedded variant is "${pin.platform}" but this process is "${platformKey}"`);
  }
  const bytes = readAsset(getAsset, VECTOR_BINARY_ASSET_PREFIX + pin.file);
  const actual = sha256Hex(bytes);
  if (actual !== pin.sha256) {
    throw new VectorUnavailableError(`sha256 mismatch for ${pin.file}: expected ${pin.sha256}, got ${actual}`);
  }

  const target = join(directory, pin.sha256.slice(0, 16));
  mkdirSync(target, { recursive: true, mode: 0o700 });
  const info = lstatSync(target);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new VectorUnavailableError(`${target} is not a plain directory`);
  if (process.platform !== 'win32') {
    if (info.uid !== process.getuid?.()) throw new VectorUnavailableError(`${target} is owned by another user`);
    chmodSync(target, 0o700);
  }

  const file = join(target, pin.file);
  try {
    if (sha256Hex(readFileSync(file)) === pin.sha256) return file;
  } catch {
    // Missing file: extract below.
  }
  // Write beside the final name and rename, so a half-written library is never loadable.
  const partial = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(partial, bytes, { mode: 0o600, flag: 'wx' });
    renameSync(partial, file);
  } finally {
    rmSync(partial, { force: true });
  }
  if (sha256Hex(readFileSync(file)) !== pin.sha256) {
    rmSync(file, { force: true });
    throw new VectorUnavailableError(`extracted ${pin.file} does not match the pinned sha256`);
  }
  return file;
}

export interface SqliteVectorOptions {
  getAsset: AssetReader;
  // Controlled location for the extracted library (REQ-DB-09).
  directory: string;
  // Fixed dimension of every vector of every collection. Defaults to 384, the size of common small embedding models.
  dimension?: number;
  // sqlite-vector distance. Defaults to COSINE: 0 is identical, smaller is closer, matching VectorMatch.
  distance?: 'L2' | 'SQUARED_L2' | 'COSINE' | 'DOT' | 'L1';
}

// The vector column of every collection table.
const COLUMN = 'embedding';
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Collections already passed to vector_init on a connection; vector_init is required once per connection.
const initialized = new WeakMap<DatabaseSync, Set<string>>();

export class SqliteVector implements SqliteVectorBackend {
  readonly #dimension: number;
  readonly #distance: string;

  constructor(private readonly options: SqliteVectorOptions) {
    this.#dimension = options.dimension ?? 384;
    this.#distance = options.distance ?? 'COSINE';
    if (!Number.isInteger(this.#dimension) || this.#dimension < 1) throw new RangeError('vector dimension must be a positive integer');
  }

  load(db: DatabaseSync): void {
    try {
      db.loadExtension(extractVectorLibrary(this.options.getAsset, this.options.directory));
    } catch (error) {
      if (error instanceof VectorUnavailableError) throw error;
      throw new VectorUnavailableError(error instanceof Error ? error.message : String(error));
    }
  }

  // Proves the library is really loaded: its version answers and the functions this backend uses exist.
  verify(db: DatabaseSync): void {
    try {
      const names = new Set(
        (db.prepare("SELECT name FROM pragma_function_list WHERE name IN ('vector_init', 'vector_as_f32')").all() as { name: string }[]).map((row) => row.name),
      );
      const scan = db.prepare("SELECT name FROM pragma_module_list WHERE name = 'vector_full_scan'").all();
      if (!names.has('vector_init') || !names.has('vector_as_f32') || scan.length === 0) throw new Error('vector functions are not registered');
      db.prepare('SELECT vector_version() AS version').get();
    } catch (error) {
      throw new VectorUnavailableError(error instanceof Error ? error.message : String(error));
    }
  }

  insert(db: DatabaseSync, collection: string, id: number, vector: Float32Array): void {
    this.#check(collection, vector);
    this.#ensure(db, collection);
    db.prepare(`INSERT OR REPLACE INTO ${collection} (id, ${COLUMN}) VALUES (?, vector_as_f32(?))`).run(id, this.#blob(vector));
  }

  search(db: DatabaseSync, collection: string, query: Float32Array, k: number): readonly VectorMatch[] {
    this.#check(collection, query);
    if (!Number.isInteger(k) || k < 1) throw new RangeError('k must be a positive integer');
    // node:sqlite binds JS numbers as REAL and the scan wants an INTEGER, so the validated k goes into the SQL text.
    this.#ensure(db, collection);
    const rows = db
      .prepare(`SELECT rowid AS id, distance FROM vector_full_scan('${collection}', '${COLUMN}', ?, ${k}) ORDER BY distance`)
      .all(this.#blob(query)) as { id: number | bigint; distance: number }[];
    return rows.map((row) => ({ id: Number(row.id), distance: row.distance }));
  }

  #check(collection: string, vector: Float32Array): void {
    // The name goes into SQL text (identifiers cannot be bound), so only plain identifiers pass.
    if (!IDENTIFIER.test(collection)) throw new RangeError(`invalid collection name "${collection}"`);
    if (vector.length !== this.#dimension) throw new RangeError(`expected a vector of ${this.#dimension} values, got ${vector.length}`);
  }

  #blob(vector: Float32Array): Uint8Array {
    return new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
  }

  #ensure(db: DatabaseSync, collection: string): void {
    let seen = initialized.get(db);
    if (seen === undefined) initialized.set(db, (seen = new Set()));
    if (seen.has(collection)) return;
    db.exec(`CREATE TABLE IF NOT EXISTS ${collection} (id INTEGER PRIMARY KEY, ${COLUMN} BLOB)`);
    db.prepare('SELECT vector_init(?, ?, ?)').get(collection, COLUMN, `dimension=${this.#dimension},type=FLOAT32,distance=${this.#distance}`);
    seen.add(collection);
  }
}
