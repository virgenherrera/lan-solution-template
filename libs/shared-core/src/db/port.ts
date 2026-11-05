// Strategy port for database engines (REQ-DB-01, REQ-DB-02). Consumers import this file only, never an engine driver.
// SQLite is the sole adapter in POC-3; a pgvector adapter implements the same port later without a consumer change.

export type SqlValue = string | number | bigint | Uint8Array | null;
export type Row = Readonly<Record<string, SqlValue>>;

export interface VectorMatch {
  readonly id: number;
  // Smaller is closer.
  readonly distance: number;
}

// Live structure of a database, as read from the engine catalog. Structurally the same shape the schema comparator expects.
// Each engine owns the union of the types its catalog reports; a new engine adds its own union to LiveColumnType.
export type SqliteLiveColumnType = 'text' | 'integer' | 'real' | 'blob';
export type LiveColumnType = SqliteLiveColumnType;

export interface LiveColumn {
  readonly type: LiveColumnType;
  readonly nullable: boolean;
  readonly primaryKey: boolean;
  readonly hasDefault: boolean;
}

export interface LiveIndex {
  readonly columns: readonly string[];
  readonly unique: boolean;
}

export interface LiveTable {
  readonly columns: Readonly<Record<string, LiveColumn>>;
  readonly indexes: readonly LiveIndex[];
}

// Table name to its live structure.
export type LiveSchema = ReadonlyMap<string, LiveTable>;

export interface DbAdapter {
  readonly engine: string;
  // Opens the connection and applies the engine pragmas. Fails fast.
  connect(): Promise<void>;
  // Proves the vector capability is really loaded. Never degrades to a non-vector mode (REQ-DB-08).
  verifyVector(): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  all(sql: string, params?: readonly SqlValue[]): Promise<readonly Row[]>;
  // One transaction per engine (REQ-DB-05): commit when fn resolves, roll back when it throws.
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  insertVector(collection: string, id: number, vector: Float32Array): Promise<void>;
  searchSimilar(collection: string, query: Float32Array, k: number): Promise<readonly VectorMatch[]>;
  // Reads the live schema. Each engine implements it from its own catalog (SQLite PRAGMA; PostgreSQL information_schema, pending).
  introspectSchema(): Promise<LiveSchema>;
  close(): Promise<void>;
}

export class VectorUnavailableError extends Error {
  constructor(reason: string) {
    super(`vector capability unavailable: ${reason}`);
    this.name = 'VectorUnavailableError';
  }
}
