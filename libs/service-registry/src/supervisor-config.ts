import { z } from 'zod';

// Every literal of the supervisor lives here, with its default. Values come from OQ11 (decision D2).
export const supervisorConfigSchema = z.object({
  // A service that has not announced ready within this time is in error.
  readinessTimeoutMs: z.number().int().min(1).default(30_000),
  // Exit code of the supervisor when the aggregate state reaches error.
  errorExitCode: z.number().int().min(1).max(255).default(1),
  // Log prefix of the supervisor's own lines.
  id: z.string().min(1).default('supervisor'),
});

export type SupervisorConfig = Readonly<z.infer<typeof supervisorConfigSchema>>;

export const SUPERVISOR_CONFIG: SupervisorConfig = Object.freeze(supervisorConfigSchema.parse({}));
