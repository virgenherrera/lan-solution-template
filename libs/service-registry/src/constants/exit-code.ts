// The only place the process exit values are spelled out. Operators and the supervisor read them (ADR-006).
export const EXIT_CODE = {
  // Clean end: done, or stopped by a signal or a shutdown message.
  ok: 0,
  // Startup or run failed: boot error, aggregate state error, failed certificate operation.
  startupFailed: 1,
  // The command line selector was rejected: unknown, empty, repeated or missing service id.
  argumentRejected: 2,
} as const;

export type ExitCode = (typeof EXIT_CODE)[keyof typeof EXIT_CODE];
