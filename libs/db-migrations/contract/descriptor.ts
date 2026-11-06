import { z } from 'zod';

// Zod schema of the table descriptor (S5). It validates tables.ts once at build and once at runtime, and the
// exported types come from it, so shape and validation cannot diverge.
const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const name = z.string().regex(NAME_PATTERN);

export const columnSchema = z
  .strictObject({
    type: z.enum(['text', 'integer', 'real', 'blob', 'bytea', 'vector']),
    nullable: z.boolean(),
    primaryKey: z.boolean(),
  })
  .readonly();

export const indexSchema = z.strictObject({ columns: z.array(name).min(1).readonly(), unique: z.boolean() }).readonly();

type TableDraft = { columns: Record<string, unknown>; indexes: readonly { columns: readonly string[] }[] };

// A table without a primary key cannot be compared or addressed by row.
function requirePrimaryKey(table: { columns: Record<string, z.infer<typeof columnSchema>> }, ctx: z.RefinementCtx): void {
  if (!Object.values(table.columns).some((column) => column.primaryKey)) {
    ctx.addIssue({ code: 'custom', message: 'table needs at least one primary key column', path: ['columns'] });
  }
}

// An index over a column the table does not declare could never match the live schema.
function requireIndexedColumnsExist(table: TableDraft, ctx: z.RefinementCtx): void {
  table.indexes.forEach((index, position) => {
    for (const column of index.columns.filter((candidate) => !(candidate in table.columns))) {
      ctx.addIssue({ code: 'custom', message: `index column "${column}" is not a column of the table`, path: ['indexes', position, 'columns'] });
    }
  });
}

export const tableSchema = z
  .strictObject({
    name,
    columns: z.record(name, columnSchema),
    indexes: z.array(indexSchema).readonly(),
  })
  .superRefine((table, ctx) => {
    requirePrimaryKey(table, ctx);
    requireIndexedColumnsExist(table, ctx);
  })
  .readonly();

// Two descriptors with one name would hide each other in the comparison.
function requireUniqueTableNames(tables: readonly { name: string }[], ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  tables.forEach((table, position) => {
    if (seen.has(table.name)) ctx.addIssue({ code: 'custom', message: `duplicate table name "${table.name}"`, path: [position, 'name'] });
    seen.add(table.name);
  });
}

export const tablesSchema = z.array(tableSchema).readonly().superRefine(requireUniqueTableNames);

export type LogicalType = z.infer<typeof columnSchema>['type'];
export type ColumnDescriptor = z.infer<typeof columnSchema>;
export type IndexDescriptor = z.infer<typeof indexSchema>;
export type TableShape = z.infer<typeof tableSchema>;
