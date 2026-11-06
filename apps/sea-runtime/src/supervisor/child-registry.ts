export interface ChildEntry {
  readonly id: string;
  readonly pid: number;
  // Spawns after the first for this id (monotonic), not the windowed RestartPolicy count.
  readonly restarts: number;
}

export abstract class ChildRegistry {
  abstract recordSpawn(id: string, pid: number): void;
  abstract entries(): readonly ChildEntry[];
}
