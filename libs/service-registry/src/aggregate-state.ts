import { type AggregateState } from './control-channel.js';
import { AGGREGATE_STATE, SERVICE_STATUS } from './states.js';

export type ServiceStatus = (typeof SERVICE_STATUS)[keyof typeof SERVICE_STATUS];

// Pure function: one aggregate state from the status of every service.
// stopping wins; a failure with no ready service is error, with a ready one degraded; a pending restart is degraded; all ready is ready.
export function aggregateState(statuses: readonly ServiceStatus[], stopping: boolean): AggregateState {
  if (stopping) return AGGREGATE_STATE.stopping;
  if (statuses.includes(SERVICE_STATUS.failed)) return statuses.includes(SERVICE_STATUS.ready) ? AGGREGATE_STATE.degraded : AGGREGATE_STATE.error;
  if (statuses.includes(SERVICE_STATUS.restarting)) return AGGREGATE_STATE.degraded;
  return statuses.every((status) => status === SERVICE_STATUS.ready) ? AGGREGATE_STATE.ready : AGGREGATE_STATE.starting;
}
