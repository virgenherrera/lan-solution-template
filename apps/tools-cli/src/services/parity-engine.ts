import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type DbAdapter } from 'shared-core';
import { PgAdapter } from 'shared-core/pg';
import { SqliteAdapter } from 'shared-core/sqlite';

// One strategy per engine: how to open the adapter on a throwaway directory. A new engine adds one class and the check itself does not change.
export interface ParityEngine {
  open(workDir: string): Promise<DbAdapter>;
  // Runs after close(), for state the adapter does not own (a database created on a server).
  cleanup?(workDir: string): Promise<void>;
}

export class SqliteParityEngine implements ParityEngine {
  open(workDir: string): Promise<DbAdapter> {
    return Promise.resolve(new SqliteAdapter({ file: 'parity.db', foreignKeys: true, journalMode: 'DELETE', synchronous: 'NORMAL' }, workDir));
  }
}

const PG_PASSWORD_FILE = 'pg.pass';

// The server comes from the --pg-* options; the password from PGPASSWORD goes to a file in the work dir, as the adapter expects (decision 11).
// Each run migrates a database of its own, so the server's other databases are never touched.
export class PgParityEngine implements ParityEngine {
  private readonly database = `parity_${randomBytes(6).toString('hex')}`;

  // `option` reads a --pg-* value when the connection is made, so a missing value fails at the same step as before.
  constructor(private readonly option: (name: string, fallback: string) => string) {}

  async open(workDir: string): Promise<DbAdapter> {
    await this.adminDo(workDir, `CREATE DATABASE ${this.database}`);
    return this.connect(workDir, this.database);
  }

  cleanup(workDir: string): Promise<void> {
    return this.adminDo(workDir, `DROP DATABASE IF EXISTS ${this.database} WITH (FORCE)`);
  }

  private async connect(workDir: string, name: string): Promise<DbAdapter> {
    writeFileSync(join(workDir, PG_PASSWORD_FILE), process.env.PGPASSWORD ?? '');
    const settings = {
      host: this.option('pg-host', 'localhost'),
      port: Number(this.option('pg-port', '5432')),
      database: name,
      user: this.option('pg-user', 'postgres'),
      passwordFile: PG_PASSWORD_FILE,
    };
    const db = new PgAdapter(settings, workDir);
    await db.connect();
    return db;
  }

  private async adminDo(workDir: string, statement: string): Promise<void> {
    const admin = await this.connect(workDir, this.option('pg-database', 'postgres'));
    try {
      await admin.run(statement);
    } finally {
      await admin.close();
    }
  }
}
