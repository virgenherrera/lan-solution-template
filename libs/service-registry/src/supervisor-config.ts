import { z } from 'zod';

// Every literal of the supervisor lives here, with its default. Values come from OQ11 (decision D2).
export const supervisorConfigSchema = z.object({
  // A service that has not announced ready within this time is in error.
  readinessTimeoutMs: z.number().int().min(1).default(30_000),
  // Exit code of the supervisor when the aggregate state reaches error.
  errorExitCode: z.number().int().min(1).max(255).default(1),
  // Log prefix of the supervisor's own lines.
  id: z.string().min(1).default('supervisor'),
  // Bounded restart policy (OQ11, decision D2). Delay n is min(initial * factor^n, max), then spread by +-jitterRatio.
  backoffInitialMs: z.number().int().min(1).default(1_000),
  backoffFactor: z.number().min(1).default(2),
  backoffMaxMs: z.number().int().min(1).default(30_000),
  jitterRatio: z.number().min(0).max(1).default(0.2),
  // At most this many restarts inside the window; the next exit leaves the service failed.
  maxRestarts: z.number().int().min(1).default(5),
  restartWindowMs: z.number().int().min(1).default(300_000),
  // A process that ran at least this long before exiting resets the attempt counter and the window.
  stableResetMs: z.number().int().min(1).default(60_000),
  // Coordinated stop (REQ-RUNTIME-06, OQ11, decision D2): a child that has not exited this long after the shutdown message is killed with its descendants.
  gracefulStopMs: z.number().int().min(1).default(10_000),
  // Windows tree kill: `<command> /pid <pid> /T /F`. Written but not verified (decision D3, REQ-TEST-09).
  windowsKillCommand: z.string().min(1).default('taskkill'),
});

export type SupervisorConfig = Readonly<z.infer<typeof supervisorConfigSchema>>;

export const SUPERVISOR_CONFIG: SupervisorConfig = Object.freeze(supervisorConfigSchema.parse({}));
