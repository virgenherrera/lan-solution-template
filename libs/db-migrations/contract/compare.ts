import type { ColumnDescriptor, IndexDescriptor, TableShape } from './descriptor.js';
import type { Engine } from './engines.js';

// Pure comparator shared by build and runtime (S5). It has no dependency on shared-core: it only reads
// the structural LiveSchema an introspector reports. 'exact' (build) fails on any difference; 'required' (runtime)
// fails only when something the build needs is missing or different, and tolerates harmless extras (S4).
export type CompareMode = 'exact' | 'required';

export interface LiveColumn extends ColumnDescriptor {
  readonly hasDefault: boolean;
}

export interface LiveTable {
  readonly columns: Readonly<Record<string, LiveColumn>>;
  readonly indexes: readonly IndexDescriptor[];
}

export type LiveSchema = ReadonlyMap<string, LiveTable>;

export interface SchemaReport {
  readonly problems: readonly string[];
  readonly tolerated: readonly string[];
}

// Tables the check never reports as extra: migrator bookkeeping and engine internals. A new engine adds one entry.
const IGNORED_TABLE: Readonly<Record<Engine, RegExp>> = {
  sqlite: /^(schema_migrations|sqlite_.*)$/,
};

const indexKey = (index: IndexDescriptor): string => `${index.unique ? 'unique ' : ''}(${index.columns.join(', ')})`;

// Every extra thing goes to problems in 'exact' mode; in 'required' mode `harmless` decides.
function classifyExtra(mode: CompareMode, harmless: boolean, line: string): SchemaReport {
  return mode === 'required' && harmless ? { problems: [], tolerated: [line] } : { problems: [line], tolerated: [] };
}

const merge = (reports: readonly SchemaReport[]): SchemaReport => ({
  problems: reports.flatMap((report) => report.problems),
  tolerated: reports.flatMap((report) => report.tolerated),
});

function problemsOnly(problems: readonly string[]): SchemaReport {
  return { problems, tolerated: [] };
}

function compareColumn(table: string, name: string, expected: ColumnDescriptor, live: LiveColumn | undefined): SchemaReport {
  if (live === undefined) return problemsOnly([`${table}.${name}: column missing`]);
  const facts = ['type', 'nullable', 'primaryKey'] as const;
  return problemsOnly(
    facts.filter((fact) => expected[fact] !== live[fact]).map((fact) => `${table}.${name}: ${fact} expected ${expected[fact]}, actual ${live[fact]}`),
  );
}

// An old binary's INSERT breaks only on a new column that is required, has no default and is not the key.
function compareExtraColumn(table: string, name: string, live: LiveColumn, mode: CompareMode): SchemaReport {
  const harmless = live.nullable || live.hasDefault || live.primaryKey;
  const line = mode === 'required' && !harmless ? `${table}.${name}: unexpected column NOT NULL without default` : `${table}.${name}: unexpected column`;
  return classifyExtra(mode, harmless, line);
}

function compareColumns(expected: TableShape, live: LiveTable, mode: CompareMode): SchemaReport {
  const wanted = Object.entries(expected.columns);
  const extra = Object.entries(live.columns).filter(([name]) => !(name in expected.columns));
  return merge([
    ...wanted.map(([name, column]) => compareColumn(expected.name, name, column, live.columns[name])),
    ...extra.map(([name, column]) => compareExtraColumn(expected.name, name, column, mode)),
  ]);
}

function compareIndexes(table: string, expected: readonly IndexDescriptor[], live: readonly IndexDescriptor[], mode: CompareMode): SchemaReport {
  const want = new Set(expected.map(indexKey));
  const have = new Set(live.map(indexKey));
  const missing = [...want].filter((key) => !have.has(key)).map((key) => `${table}: index ${key} missing`);
  const extra = [...have].filter((key) => !want.has(key)).map((key) => classifyExtra(mode, true, `${table}: unexpected index ${key}`));
  return merge([problemsOnly(missing), ...extra]);
}

function compareTable(expected: TableShape, live: LiveTable | undefined, mode: CompareMode): SchemaReport {
  if (live === undefined) return problemsOnly([`${expected.name}: table missing`]);
  return merge([compareColumns(expected, live, mode), compareIndexes(expected.name, expected.indexes, live.indexes, mode)]);
}

function compareExtraTables(expected: readonly TableShape[], live: LiveSchema, mode: CompareMode, engine: Engine): SchemaReport {
  const known = new Set(expected.map((table) => table.name));
  const extra = [...live.keys()].filter((name) => !known.has(name) && !IGNORED_TABLE[engine].test(name));
  return merge(extra.map((name) => classifyExtra(mode, true, `${name}: unexpected table`)));
}

// `engine` selects the engine-internal tables to skip. It defaults to sqlite so existing callers keep compiling; a caller of another engine must pass it.
export function compareSchema(expected: readonly TableShape[], live: LiveSchema, mode: CompareMode, engine: Engine = 'sqlite'): SchemaReport {
  return merge([...expected.map((table) => compareTable(table, live.get(table.name), mode)), compareExtraTables(expected, live, mode, engine)]);
}
