import { mkdirSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { dirname, isAbsolute, join } from 'node:path';
import type { AppConfig } from '../../config.js';
import type { AppPaths } from '../../paths.js';
import {
  VectorUnavailableError,
  type DbAdapter,
  type LiveColumnType,
  type LiveIndex,
  type LiveSchema,
  type LiveTable,
  type Row,
  type SqlValue,
  type VectorMatch,
} from '../port.js';

// Vector backend of the SQLite engine: loads the native library into an open connection and runs vector SQL. Plugged in by POC-3d.
export interface SqliteVectorBackend {
  load(db: DatabaseSync): void;
  verify(db: DatabaseSync): void;
  insert(db: DatabaseSync, collection: string, id: number, vector: Float32Array): void;
  search(db: DatabaseSync, collection: string, query: Float32Array, k: number): readonly VectorMatch[];
}

type SqliteSettings = Extract<AppConfig['db'], { engine: 'sqlite' }>['sqlite'];

const SQLITE_TYPES: Readonly<Record<string, LiveColumnType>> = { TEXT: 'text', INTEGER: 'integer', REAL: 'real', BLOB: 'blob' };

// A type SQLite reports that has no logical name stays as written, so the diff shows it.
function logicalTypeOfSqlite(declared: unknown): LiveColumnType {
  const name = String(declared).toUpperCase();
  return SQLITE_TYPES[name] ?? (name.toLowerCase() as LiveColumnType);
}

// PRAGMA arguments cannot be bound; table names come from sqlite_master, so quote them.
const quoted = (name: string): string => `"${name.replaceAll('"', '""')}"`;

export class SqliteAdapter implements DbAdapter {
  readonly engine = 'sqlite';
  #db: DatabaseSync | undefined;

  constructor(
    private readonly settings: SqliteSettings,
    private readonly dataDir: string,
    private readonly vector?: SqliteVectorBackend,
  ) {}

  #open(): DatabaseSync {
    if (this.#db === undefined) throw new Error('sqlite adapter is not connected');
    return this.#db;
  }

  get filePath(): string {
    return isAbsolute(this.settings.file) ? this.settings.file : join(this.dataDir, this.settings.file);
  }

  async connect(): Promise<void> {
    if (this.#db !== undefined) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    const db = new DatabaseSync(this.filePath, { allowExtension: this.vector !== undefined, enableForeignKeyConstraints: this.settings.foreignKeys });
    // Pragma values come from the Zod enums, never from user text.
    db.exec(`PRAGMA journal_mode = ${this.settings.journalMode}`);
    db.exec(`PRAGMA synchronous = ${this.settings.synchronous}`);
    this.#db = db;
    this.vector?.load(db);
  }

  async verifyVector(): Promise<void> {
    if (this.vector === undefined) throw new VectorUnavailableError('no vector backend is configured');
    this.vector.verify(this.#open());
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    this.#open().prepare(sql).run(...(params as SQLInputValue[]));
  }

  async all(sql: string, params: readonly SqlValue[] = []): Promise<readonly Row[]> {
    return this.#open().prepare(sql).all(...(params as SQLInputValue[])) as unknown as Row[];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const db = this.#open();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  async insertVector(collection: string, id: number, vector: Float32Array): Promise<void> {
    if (this.vector === undefined) throw new VectorUnavailableError('no vector backend is configured');
    this.vector.insert(this.#open(), collection, id, vector);
  }

  async searchSimilar(collection: string, query: Float32Array, k: number): Promise<readonly VectorMatch[]> {
    if (this.vector === undefined) throw new VectorUnavailableError('no vector backend is configured');
    return this.vector.search(this.#open(), collection, query, k);
  }

  async #indexes(table: string): Promise<LiveIndex[]> {
    const list = await this.all(`PRAGMA index_list(${quoted(table)})`);
    // origin 'pk' is the implicit index behind a primary key; the descriptor does not list it.
    const explicit = list.filter((index) => index.origin !== 'pk');
    return Promise.all(
      explicit.map(async (index) => {
        const info = await this.all(`PRAGMA index_info(${quoted(String(index.name))})`);
        return { columns: [...info].sort((a, b) => Number(a.seqno) - Number(b.seqno)).map((part) => String(part.name)), unique: index.unique === 1 };
      }),
    );
  }

  async introspectSchema(): Promise<LiveSchema> {
    const names = await this.all(`SELECT name FROM sqlite_master WHERE type = 'table'`);
    const schema = new Map<string, LiveTable>();
    for (const { name } of names) {
      const table = String(name);
      if (table.startsWith('sqlite_')) continue;
      const info = await this.all(`PRAGMA table_info(${quoted(table)})`);
      const columns = Object.fromEntries(
        info.map((column) => [
          String(column.name),
          { type: logicalTypeOfSqlite(column.type), nullable: column.notnull === 0, primaryKey: Number(column.pk) > 0, hasDefault: column.dflt_value !== null },
        ]),
      );
      schema.set(table, { columns, indexes: await this.#indexes(table) });
    }
    return schema;
  }

  async close(): Promise<void> {
    this.#db?.close();
    this.#db = undefined;
  }
}
