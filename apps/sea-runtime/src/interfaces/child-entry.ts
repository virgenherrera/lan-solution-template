export interface ChildEntry {
  readonly id: string;
  // Absent while no child runs: before the first spawn, after an exit, and when a spawn gave no pid.
  readonly pid?: number;
  // Spawns after the first for this id (monotonic), not the windowed RestartPolicy count.
  readonly restarts: number;
}
