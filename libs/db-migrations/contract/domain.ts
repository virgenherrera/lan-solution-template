// Logical rows of the contract (S6). Engine schemas must match these shapes; no engine type appears here.
export interface AppMetaRow {
  key: string;
  value: string;
}

// Every property of an engine class must be a Drizzle column builder (any dialect) whose data type and
// nullability match the logical row. Type-only: the contract never imports Drizzle.
export type ColumnsOf<Row> = {
  readonly [K in keyof Row]: { readonly _: { readonly data: Row[K]; readonly notNull: true } };
};

// `implements` does not reject extra properties, so engine schemas also assert this to close that gap.
export type NoExtra<Columns, Row> = Exclude<keyof Columns, keyof Row> extends never ? true : false;

export type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// Compile-time assertion: fails to type-check unless T is exactly `true`.
export type Expect<T extends true> = T;
