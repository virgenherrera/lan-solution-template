import { mkdirSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { dirname, isAbsolute, join } from 'node:path';
import type { AppConfig } from '../config.js';
import type { AppPaths } from '../paths.js';
import { VectorUnavailableError, type DbAdapter, type Row, type SqlValue, type VectorMatch } from './port.js';

// Vector backend of the SQLite engine: loads the native library into an open connection and runs vector SQL. Plugged in by POC-3d.
export interface SqliteVectorBackend {
  load(db: DatabaseSync): void;
  verify(db: DatabaseSync): void;
  insert(db: DatabaseSync, collection: string, id: number, vector: Float32Array): void;
  search(db: DatabaseSync, collection: string, query: Float32Array, k: number): readonly VectorMatch[];
}

type SqliteSettings = AppConfig['db']['sqlite'];

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

  async close(): Promise<void> {
    this.#db?.close();
    this.#db = undefined;
  }
}
