import { Injectable, Logger } from '@nestjs/common';
import {
  CONTROL_KIND,
  SIDECAR_KIND,
  SUPERVISOR_CONFIG,
  aggregateState,
  stateMessage,
  stateMessageSchema,
  type AggregateState,
} from 'service-registry';
import { ChildRegistry } from '../interfaces/child-registry.js';
import { SidecarOutput } from './sidecar-output.js';
import { type ServiceLifecycle } from './service-lifecycle.js';

// Owns the aggregate state. A change goes to the log (stderr), to the host (stdout event) and to the running services (IPC).
@Injectable()
export class StatusPublisher {
  private readonly logger = new Logger(SUPERVISOR_CONFIG.id);
  private state?: AggregateState;
  private stopping = false;

  constructor(
    private readonly output: SidecarOutput,
    private readonly registry: ChildRegistry,
  ) {}

  // From now on the aggregate state is stopping, whatever the services report.
  markStopping(): void {
    this.stopping = true;
  }

  publish(services: readonly ServiceLifecycle[]): AggregateState {
    const state = aggregateState(services.map(({ status }) => status), this.stopping);
    if (state === this.state) return state;
    const entries = new Map(this.registry.entries().map((entry) => [entry.id, entry]));
    const list = services.map(({ id, status }) => {
      const entry = entries.get(id);
      if (entry === undefined) return { id, status };
      return entry.pid === undefined ? { id, status, restarts: entry.restarts } : { id, status, pid: entry.pid, restarts: entry.restarts };
    });
    this.state = state;
    this.logger.log(stateMessage(state));
    this.output.emit({ kind: SIDECAR_KIND.status, state, services: list });
    const message = stateMessageSchema.parse({ kind: CONTROL_KIND.state, state });
    for (const { child } of services) {
      if (child?.connected) child.send(message, () => undefined);
    }
    return state;
  }
}
