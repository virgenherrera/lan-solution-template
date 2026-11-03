import { Injectable } from '@nestjs/common';
import {
  CONTROL_KIND,
  SIDECAR_KIND,
  aggregateState,
  stateMessage,
  stateMessageSchema,
  type AggregateState,
} from 'service-registry';
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
  ) {}

  // From now on the aggregate state is stopping, whatever the services report.
  markStopping(): void {
    this.stopping = true;
  }

  publish(services: readonly ServiceLifecycle[]): AggregateState {
    const state = aggregateState(services.map(({ status }) => status), this.stopping);
    if (state === this.state) return state;
    this.state = state;
    this.logger.log(stateMessage(state));
    this.output.emit({ kind: SIDECAR_KIND.status, state, services: services.map(({ id, status }) => ({ id, status })) });
    const message = stateMessageSchema.parse({ kind: CONTROL_KIND.state, state });
    for (const { child } of services) {
      if (child?.connected) child.send(message, () => undefined);
    }
    return state;
  }
}
