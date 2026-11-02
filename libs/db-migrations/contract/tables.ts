import type { AppMetaRow } from './domain.js';

// Declarative description of each table (S6). The parity check compares it with what the real migrations create.
// Logical types: each engine maps its physical types onto these names.
export type LogicalType = 'text' | 'integer' | 'real' | 'blob' | 'vector';

export interface ColumnDescriptor {
  readonly type: LogicalType;
  readonly nullable: boolean;
  readonly primaryKey: boolean;
}

export interface IndexDescriptor {
  readonly columns: readonly string[];
  readonly unique: boolean;
}

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

// Every table the migrations are expected to create. A new table is added here and to the engine schemas.
export const tables: readonly TableDescriptor<any>[] = [appMetaTable];
