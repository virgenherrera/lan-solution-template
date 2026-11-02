import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { AppMetaRow, ColumnsOf, Expect, NoExtra } from '../contract/index.js';

// One builder property per logical column. `implements` catches missing, nullable and wrong-type columns.
class AppMetaColumns implements ColumnsOf<AppMetaRow> {
  readonly key = text('key').primaryKey().notNull();
  readonly value = text('value').notNull();
}

// `implements` misses extra columns, so this line closes that gap.
export type AppMetaConforms = Expect<NoExtra<AppMetaColumns, AppMetaRow>>;

// Spread needed: a class has no implicit index signature. drizzle-kit only sees module-level exports.
export const appMeta = sqliteTable('app_meta', { ...new AppMetaColumns() });
