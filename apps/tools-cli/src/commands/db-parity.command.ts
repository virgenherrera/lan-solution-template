import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { compareSchema, tablesByEngine, tablesSchema } from 'db-migrations';
import { Command, CommandRunner } from 'nest-commander';
import { EXIT_CODE, jsonText } from 'service-registry';
import { runMigrations } from 'shared-core';
import { z } from 'zod';
import { ExitError } from '../constants/exit-error.js';
import { PgParityEngine, SqliteParityEngine, type ParityEngine } from '../services/parity-engine.js';
import { RepoRoot } from '../services/repo-root.service.js';

// Parity check (S6). Run from anywhere: `tools-cli db-parity [--engine sqlite|pg] [--migrations-dir <dir>]`.
// Engine pg also takes [--pg-host localhost] [--pg-port 5432] [--pg-user postgres] [--pg-database postgres] and PGPASSWORD (default empty).
// It creates a throwaway database on that server, migrates it, compares it and drops it.
// Applies the real migrations with the real migrator to a temp database, reads the resulting structure back and
// compares it with the declarative descriptor in libs/db-migrations/contract/tables.ts. Exit 0 = parity, 1 = diff or error.
// Needs the built libraries, which `nx run tools-cli:build` builds first.
const KNOWN_ENGINES = ['sqlite', 'pg'];

// Drizzle owns the journal file, so only the fields read here are checked.
const journalSchema = z.looseObject({ entries: z.array(z.looseObject({ idx: z.number(), tag: z.string() })) });

interface ParityMigration {
  version: number;
  name: string;
  sql: string;
}

@Command({
  name: 'db-parity',
  description: 'Migrate a throwaway database with the real migrations and compare its structure with the descriptor (S6).',
  arguments: '[args...]',
  // The command reads its own options from the arguments, as the retired script did.
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
@Injectable()
export class DbParityCommand extends CommandRunner {
  constructor(private readonly repo: RepoRoot) {
    super();
  }

  override async run(passedParams: string[]): Promise<void> {
    let code: number;
    try {
      code = await this.check(passedParams);
    } catch (error) {
      process.stderr.write(`${this.describeError(error)}\n`);
      throw new ExitError(EXIT_CODE.startupFailed);
    }
    if (code !== 0) throw new ExitError(code);
  }

  private async check(args: readonly string[]): Promise<number> {
    const engine = this.option(args, 'engine', 'sqlite');
    const strategy = this.engineFor(engine, args);
    const migrations = this.readMigrations(resolve(this.option(args, 'migrations-dir', this.defaultMigrationsDir(engine))));

    const workDir = mkdtempSync(join(tmpdir(), 'db-parity-'));
    const db = await strategy.open(workDir);
    try {
      await db.connect();
      await runMigrations(db, migrations);
      const key = engine as keyof typeof tablesByEngine;
      const tables = tablesByEngine[key];
      // Validate the descriptor itself first, then compare it exactly with what the real migrations built.
      const diff = compareSchema(tablesSchema.parse(tables), await db.introspectSchema(), 'exact', key).problems;
      if (diff.length === 0) {
        process.stdout.write(`parity ok: ${tables.length} table(s) match the descriptor (engine ${engine})\n`);
        return 0;
      }
      process.stderr.write(`parity FAILED (engine ${engine}):\n${diff.map((line) => `  ${line}`).join('\n')}\n`);
      return 1;
    } finally {
      await db.close();
      await strategy.cleanup?.(workDir);
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  private engineFor(engine: string, args: readonly string[]): ParityEngine {
    if (engine === 'sqlite') return new SqliteParityEngine();
    if (engine === 'pg') return new PgParityEngine((name, fallback) => this.option(args, name, fallback));
    throw new Error(`no introspector for engine "${engine}" (known: ${KNOWN_ENGINES.join(', ')})`);
  }

  private defaultMigrationsDir(engine: string): string {
    return join(this.repo.path, 'libs', 'db-migrations', engine, 'migrations');
  }

  // Same order and numbering as the migrator input: journal idx + 1 is the version.
  private readMigrations(dir: string): ParityMigration[] {
    const journalPath = join(dir, 'meta', '_journal.json');
    const parsed = jsonText(journalSchema).safeParse(readFileSync(journalPath, 'utf8'));
    if (!parsed.success) throw new Error(`${journalPath}: ${z.prettifyError(parsed.error)}`);
    return [...parsed.data.entries]
      .sort((a, b) => a.idx - b.idx)
      .map((entry) => ({ version: entry.idx + 1, name: entry.tag, sql: readFileSync(join(dir, `${entry.tag}.sql`), 'utf8') }));
  }

  private option(args: readonly string[], name: string, fallback: string): string {
    const index = args.indexOf(`--${name}`);
    if (index < 0) return fallback;
    const value = args[index + 1];
    if (value === undefined) throw new Error(`--${name} needs a value`);
    return value;
  }

  // A refused connection reaches us as an AggregateError with an empty message (one inner error per address tried), so the inner messages carry the cause.
  private describeError(error: unknown): string {
    if (error instanceof AggregateError) {
      const inner = error.errors.map((item) => this.describeError(item)).join('\n');
      return error.message === '' ? inner : `${error.message}\n${inner}`;
    }
    if (!(error instanceof Error)) return String(error);
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && !error.message.includes(code) ? `${code}: ${error.message}` : error.message;
  }
}
