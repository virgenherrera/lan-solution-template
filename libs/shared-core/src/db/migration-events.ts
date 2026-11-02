// What the migrator tells its subscriber while it runs (REQ-DB-05). One event per step, in order.
interface MigrationStep {
  readonly version: number;
  readonly name: string;
}

// The migration passed every check and is about to be looked up in the history.
export interface MigrationChecked extends MigrationStep {
  readonly type: 'checked';
}

// The history already holds this version; nothing ran.
export interface MigrationSkipped extends MigrationStep {
  readonly type: 'skipped';
}

// The SQL ran and the history row was committed with it.
export interface MigrationApplied extends MigrationStep {
  readonly type: 'applied';
  readonly durationMs: number;
}

export type MigrationEvent = MigrationChecked | MigrationSkipped | MigrationApplied;
