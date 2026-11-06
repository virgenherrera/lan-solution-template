export interface ChildEntry {
  readonly id: string;
  // Absent while no child runs: before the first spawn, after an exit, and when a spawn gave no pid.
  readonly pid?: number;
  // Spawns after the first for this id (monotonic), not the windowed RestartPolicy count.
  readonly restarts: number;
}

export abstract class ChildRegistry {
  // Called for every spawn attempt, also one that gave no pid, so `restarts` counts it.
  abstract recordSpawn(id: string, pid: number | undefined): void;
  // The child with this pid ended: its pid no longer names a live process.
  abstract recordExit(id: string, pid: number | undefined): void;
  abstract entries(): readonly ChildEntry[];
}
