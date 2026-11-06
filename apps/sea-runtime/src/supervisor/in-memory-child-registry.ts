import { Injectable } from '@nestjs/common';
import { type ChildEntry, ChildRegistry } from './child-registry.js';

@Injectable()
export class InMemoryChildRegistry extends ChildRegistry {
  private readonly byId = new Map<string, ChildEntry>();

  recordSpawn(id: string, pid: number): void {
    const previous = this.byId.get(id);
    this.byId.set(id, { id, pid, restarts: previous === undefined ? 0 : previous.restarts + 1 });
  }

  entries(): readonly ChildEntry[] {
    return [...this.byId.values()];
  }
}
