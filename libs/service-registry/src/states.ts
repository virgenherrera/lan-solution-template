// The only place the state words of the runtime are spelled out (REQ-RUNTIME-05).

// Aggregate state of the whole runtime.
export const AGGREGATE_STATE = {
  starting: 'starting',
  ready: 'ready',
  degraded: 'degraded',
  error: 'error',
  stopping: 'stopping',
} as const;

// Status of one supervised service.
export const SERVICE_STATUS = {
  starting: 'starting',
  ready: 'ready',
  restarting: 'restarting',
  failed: 'failed',
} as const;

// Kind of each control-channel message between supervisor and children.
export const CONTROL_KIND = {
  ready: 'ready',
  state: 'state',
  shutdown: 'shutdown',
} as const;
