import { Injectable } from '@nestjs/common';
import type { ChildEntry } from '../interfaces/child-entry.js';

@Injectable()
export class InMemoryChildRegistry {
  private readonly byId = new Map<string, ChildEntry>();

  recordSpawn(id: string, pid: number | undefined): void {
    const previous = this.byId.get(id);
    this.byId.set(id, { id, pid, restarts: previous === undefined ? 0 : previous.restarts + 1 });
  }

  recordExit(id: string, pid: number | undefined): void {
    const current = this.byId.get(id);
    if (current !== undefined && current.pid === pid) this.byId.set(id, { id, restarts: current.restarts });
  }

  entries(): readonly ChildEntry[] {
    return [...this.byId.values()];
  }
}
