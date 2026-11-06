import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import type { DbConfig } from '../../config-dtos.js';
import {
  VectorUnavailableError,
  type DbAdapter,
  type LiveColumnType,
  type LiveIndex,
  type LiveSchema,
  type LiveTable,
  type PgLiveColumnType,
  type Row,
  type SqlValue,
  type VectorMatch,
} from '../port.js';

type PgSettings = Extract<DbConfig, { engine: 'pg' }>['pg'];

// information_schema data_type to the logical names the table descriptors use. A type with no logical name stays as the
// server reports it (lowercased), so the diff shows it.
const PG_TYPES: Readonly<Record<string, PgLiveColumnType>> = {
  text: 'text',
  integer: 'integer',
  real: 'real',
  bytea: 'bytea',
};

function logicalTypeOfPg(dataType: string, udtName: string): LiveColumnType {
  if (dataType === 'USER-DEFINED' && udtName === 'vector') return 'vector';
  return PG_TYPES[dataType] ?? (dataType.toLowerCase() as LiveColumnType);
}

const COLUMN = 'embedding';
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PERMISSION_DENIED = '42501';

// The port speaks `?` placeholders (the migrator is shared with SQLite); PostgreSQL wants $1, $2. A `?` inside a quoted literal stays.
function numberPlaceholders(sql: string): string {
  let index = 0;
  return sql
    .split(/('(?:[^']|'')*')/)
    .map((part, position) => (position % 2 === 1 ? part : part.replace(/\?/g, () => `$${++index}`)))
    .join('');
}

// pg serializes Uint8Array as an array literal; bytea needs a Buffer. bigint travels as text.
function toDriverValue(value: SqlValue): string | number | Buffer | null {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return value;
}

const vectorLiteral = (vector: Float32Array): string => `[${Array.from(vector).join(',')}]`;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export class PgAdapter implements DbAdapter {
  readonly engine = 'pg';
  #client: pg.Client | undefined;
  readonly #collections = new Set<string>();

  constructor(
    private readonly settings: PgSettings,
    private readonly dataDir: string,
    private readonly dimension: number = 384,
  ) {
    if (!Number.isInteger(dimension) || dimension < 1) throw new RangeError('vector dimension must be a positive integer');
  }

  #open(): pg.Client {
    if (this.#client === undefined) throw new Error('pg adapter is not connected');
    return this.#client;
  }

  async connect(): Promise<void> {
    if (this.#client !== undefined) return;
    const { host, port, database, user, passwordFile } = this.settings;
    const password = readFileSync(join(this.dataDir, passwordFile), 'utf8').trim();
    const client = new pg.Client({ host, port, database, user, password });
    await client.connect();
    this.#client = client;
  }

  // Detects what is missing and says what to do. It never degrades to a non-vector mode (REQ-DB-08).
  async verifyVector(): Promise<void> {
    const client = this.#open();
    try {
      const available = await client.query(`SELECT 1 FROM pg_available_extensions WHERE name = 'vector'`);
      if (available.rowCount === 0) {
        throw new VectorUnavailableError('the pgvector extension is not installed on the PostgreSQL server (it is not in pg_available_extensions): install pgvector on the server');
      }
      const installed = await client.query(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`);
      if (installed.rowCount === 0) await this.#createExtension(client);
      await client.query(`SELECT '[1,0,0]'::vector <=> '[0,1,0]'::vector AS distance`);
    } catch (error) {
      throw error instanceof VectorUnavailableError ? error : new VectorUnavailableError(errorText(error));
    }
  }

  async #createExtension(client: pg.Client): Promise<void> {
    try {
      await client.query('CREATE EXTENSION vector');
    } catch (error) {
      if ((error as { code?: string }).code !== PERMISSION_DENIED) throw error;
      const { rows } = await client.query<{ rolsuper: boolean; trusted: boolean | null; database: string; role: string }>(
        `SELECT rolsuper, current_database() AS database, current_user AS role,
                (SELECT trusted FROM pg_available_extension_versions WHERE name = 'vector' LIMIT 1) AS trusted
           FROM pg_roles WHERE rolname = current_user`,
      );
      const who = rows[0];
      throw new VectorUnavailableError(
        `role "${who?.role}" cannot install the pgvector extension in database "${who?.database}" (superuser: ${who?.rolsuper}, extension trusted: ${who?.trusted}): ` +
          `ask a PostgreSQL administrator to run CREATE EXTENSION vector in that database, or use a superuser role`,
      );
    }
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    await this.#open().query(numberPlaceholders(sql), params.map(toDriverValue));
  }

  async all(sql: string, params: readonly SqlValue[] = []): Promise<readonly Row[]> {
    const result = await this.#open().query(numberPlaceholders(sql), params.map(toDriverValue));
    return result.rows as Row[];
  }

  // One connection serializes the queries, so BEGIN and COMMIT bracket exactly the calls made inside fn.
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const client = this.#open();
    await client.query('BEGIN');
    try {
      const result = await fn();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  #check(collection: string, vector: Float32Array): void {
    // The name goes into SQL text (identifiers cannot be bound), so only plain identifiers pass.
    if (!IDENTIFIER.test(collection)) throw new RangeError(`invalid collection name "${collection}"`);
    if (vector.length !== this.dimension) throw new RangeError(`expected a vector of ${this.dimension} values, got ${vector.length}`);
  }

  async #ensure(collection: string): Promise<void> {
    if (this.#collections.has(collection)) return;
    await this.#open().query(`CREATE TABLE IF NOT EXISTS ${collection} (id bigint PRIMARY KEY, ${COLUMN} vector(${this.dimension}))`);
    this.#collections.add(collection);
  }

  async insertVector(collection: string, id: number, vector: Float32Array): Promise<void> {
    this.#check(collection, vector);
    await this.#ensure(collection);
    await this.#open().query(
      `INSERT INTO ${collection} (id, ${COLUMN}) VALUES ($1, $2::vector) ON CONFLICT (id) DO UPDATE SET ${COLUMN} = EXCLUDED.${COLUMN}`,
      [id, vectorLiteral(vector)],
    );
  }

  async searchSimilar(collection: string, query: Float32Array, k: number): Promise<readonly VectorMatch[]> {
    this.#check(collection, query);
    if (!Number.isInteger(k) || k < 1) throw new RangeError('k must be a positive integer');
    await this.#ensure(collection);
    // Cosine distance, the same metric the SQLite backend defaults to: 0 is identical, smaller is closer.
    const { rows } = await this.#open().query<{ id: string; distance: number }>(
      `SELECT id, ${COLUMN} <=> $1::vector AS distance FROM ${collection} ORDER BY distance LIMIT ${k}`,
      [vectorLiteral(query)],
    );
    return rows.map((row) => ({ id: Number(row.id), distance: Number(row.distance) }));
  }

  async introspectSchema(): Promise<LiveSchema> {
    const client = this.#open();
    const columns = await client.query<{ table_name: string; column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null }>(
      `SELECT c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default
         FROM information_schema.columns c
         JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = current_schema()
        ORDER BY c.table_name, c.ordinal_position`,
    );
    const keys = await client.query<{ table_name: string; column_name: string }>(
      `SELECT kcu.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_schema = tc.constraint_schema AND kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = current_schema()`,
    );
    const indexes = await client.query<{ table_name: string; columns: string[]; is_unique: boolean }>(
      `SELECT t.relname::text AS table_name, ix.indisunique AS is_unique, array_agg(a.attname::text ORDER BY k.ord) AS columns
         FROM pg_index ix
         JOIN pg_class t ON t.oid = ix.indrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
        WHERE n.nspname = current_schema() AND t.relkind = 'r' AND NOT ix.indisprimary
        GROUP BY t.relname, ix.indexrelid, ix.indisunique`,
    );
    const primary = new Set(keys.rows.map((key) => `${key.table_name}.${key.column_name}`));
    const schema = new Map<string, LiveTable>();
    for (const column of columns.rows) {
      const table = schema.get(column.table_name) ?? { columns: {}, indexes: [] as LiveIndex[] };
      (table.columns as Record<string, LiveTable['columns'][string]>)[column.column_name] = {
        type: logicalTypeOfPg(column.data_type, column.udt_name),
        nullable: column.is_nullable === 'YES',
        primaryKey: primary.has(`${column.table_name}.${column.column_name}`),
        hasDefault: column.column_default !== null,
      };
      schema.set(column.table_name, table);
    }
    for (const index of indexes.rows) {
      (schema.get(index.table_name)?.indexes as LiveIndex[] | undefined)?.push({ columns: index.columns, unique: index.is_unique });
    }
    return schema;
  }

  async close(): Promise<void> {
    await this.#client?.end();
    this.#client = undefined;
  }
}
