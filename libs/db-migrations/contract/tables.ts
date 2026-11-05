import type { Engine } from './engines.js';
import type { ColumnDescriptor, IndexDescriptor } from './descriptor.js';
import type { AppMetaRow } from './domain.js';

// Declarative description of each table (S6). The parity check compares it with what the real migrations create.
// Types come from the Zod descriptor (descriptor.ts) so validation and types cannot diverge.
export type { ColumnDescriptor, IndexDescriptor, LogicalType } from './descriptor.js';

// One descriptor per row type. The mapped type needs exactly the row's columns: a missing or extra one fails to compile,
// so descriptor and contract cannot diverge.
export interface TableDescriptor<Row = Record<string, unknown>> {
  readonly name: string;
  readonly columns: { readonly [K in keyof Row & string]: ColumnDescriptor };
  // Explicit indexes only; the implicit index behind a primary key is not listed.
  readonly indexes: readonly IndexDescriptor[];
}

export const appMetaTable: TableDescriptor<AppMetaRow> = {
  name: 'app_meta',
  columns: {
    key: { type: 'text', nullable: false, primaryKey: true },
    value: { type: 'text', nullable: false, primaryKey: false },
  },
  indexes: [],
};

// Every table each engine's migrations are expected to create. A new table is added here and to the engine schemas; a new engine adds a key.
export const tablesByEngine: Readonly<Record<Engine, readonly TableDescriptor<any>[]>> = {
  sqlite: [appMetaTable],
  pg: [appMetaTable],
};
