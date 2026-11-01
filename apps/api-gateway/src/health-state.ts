import { Injectable } from '@nestjs/common';
import { AGGREGATE_STATE, stateMessageSchema, type AggregateState } from 'service-registry';

// Aggregate state of the runtime as last told by the supervisor. Standalone (no supervisor) it starts at "starting" and the bootstrap sets "ready" after listen.
@Injectable()
export class HealthState {
  private current: AggregateState = AGGREGATE_STATE.starting;

  get(): AggregateState {
    return this.current;
  }

  set(state: AggregateState): void {
    this.current = state;
  }

  // Applies a state message from the supervisor; anything that is not a valid state message is ignored.
  apply(raw: unknown): void {
    const parsed = stateMessageSchema.safeParse(raw);
    if (parsed.success) this.current = parsed.data.state;
  }
}
