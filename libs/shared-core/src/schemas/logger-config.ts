import { z } from 'zod';

// The one input of the logger. Every value arrives through this schema, defaults included; the logger reads nothing from argv, the environment or the terminal.
export const loggerConfigSchema = z.strictObject({
  // The name of the process. It goes first on every line of the sidecar target.
  prefix: z.string().min(1),
  // 'sidecar': the Nest text format on stderr, for the processes the supervisor starts. 'cli': only the message text, for an install operation whose output a script reads.
  target: z.enum(['sidecar', 'cli']).default('sidecar'),
  // true: one JSON object per line, with the keys of the OpenTelemetry log record.
  json: z.boolean().default(false),
});

export type LoggerConfigInput = z.input<typeof loggerConfigSchema>;
export type LoggerConfig = z.output<typeof loggerConfigSchema>;
