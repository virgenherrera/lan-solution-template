// Strategy port for database engines (REQ-DB-01, REQ-DB-02). Consumers import this file only, never an engine driver.
// SQLite is the sole adapter in POC-3; a pgvector adapter implements the same port later without a consumer change.

export type SqlValue = string | number | bigint | Uint8Array | null;
export type Row = Readonly<Record<string, SqlValue>>;

export interface VectorMatch {
  readonly id: number;
  // Smaller is closer.
  readonly distance: number;
}

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
  close(): Promise<void>;
}

export class VectorUnavailableError extends Error {
  constructor(reason: string) {
    super(`vector capability unavailable: ${reason}`);
    this.name = 'VectorUnavailableError';
  }
}
