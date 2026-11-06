import { Injectable } from '@nestjs/common';
import {
  CONTROL_KIND,
  SIDECAR_KIND,
  aggregateState,
  stateMessage,
  stateMessageSchema,
  type AggregateState,
} from 'service-registry';
import { ChildRegistry } from './child-registry.js';
import { SidecarOutput } from '../sidecar/sidecar-output.js';
import { SupervisorLogger } from '../sidecar/supervisor-logger.js';
import { type ServiceLifecycle } from './service-lifecycle.js';

// Owns the aggregate state. A change goes to the log (stderr), to the host (stdout event) and to the running services (IPC).
@Injectable()
export class StatusPublisher {
  private state?: AggregateState;
  private stopping = false;

  constructor(
    private readonly logger: SupervisorLogger,
    private readonly output: SidecarOutput,
    private readonly registry: ChildRegistry,
  ) {}

  // From now on the aggregate state is stopping, whatever the services report.
  markStopping(): void {
    this.stopping = true;
  }

  publish(services: readonly ServiceLifecycle[]): AggregateState {
    const state = aggregateState(services.map(({ status }) => status), this.stopping);
    const entries = new Map(this.registry.entries().map((entry) => [entry.id, entry]));
    const list = services.map(({ id, status }) => {
      const entry = entries.get(id);
      return entry === undefined ? { id, status } : { id, status, pid: entry.pid, restarts: entry.restarts };
    });
    if (state === this.state) return state;
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
