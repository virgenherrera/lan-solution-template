import { type AggregateState } from './control-channel.js';

export type ServiceStatus = 'starting' | 'ready' | 'restarting' | 'failed';

// Pure function: one aggregate state from the status of every service.
// stopping wins; a failure with no ready service is error, with a ready one degraded; a pending restart is degraded; all ready is ready.
export function aggregateState(statuses: readonly ServiceStatus[], stopping: boolean): AggregateState {
  if (stopping) return 'stopping';
  if (statuses.includes('failed')) return statuses.includes('ready') ? 'degraded' : 'error';
  if (statuses.includes('restarting')) return 'degraded';
  return statuses.every((status) => status === 'ready') ? 'ready' : 'starting';
}
