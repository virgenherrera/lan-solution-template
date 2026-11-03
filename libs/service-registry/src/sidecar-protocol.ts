import { z } from 'zod';
import { jsonText } from './json-text.js';
import { statusSnapshotSchema } from './status-snapshot.js';

// The sidecar contract with the host (Tauri). The host sees the supervisor through four things only: stdout lines, stderr lines, stdin lines and the exit code.
// stdout carries machine events and nothing else; stderr carries every human log line; stdin carries host commands. One JSON object per line, always validated.

export const SIDECAR_KIND = {
  status: 'status',
  shutdown: 'shutdown',
} as const;

// stdout, supervisor to host: the aggregate state plus one status per service, sent on every change.
export const sidecarStatusEventSchema = z.strictObject({
  kind: z.literal(SIDECAR_KIND.status),
  ...statusSnapshotSchema.shape,
});

export const sidecarEventSchema = z.discriminatedUnion('kind', [sidecarStatusEventSchema]);

export type SidecarEvent = z.infer<typeof sidecarEventSchema>;

// stdin, host to supervisor: stop every service and exit.
export const sidecarShutdownCommandSchema = z.strictObject({ kind: z.literal(SIDECAR_KIND.shutdown) });

export const sidecarCommandSchema = z.discriminatedUnion('kind', [sidecarShutdownCommandSchema]);

export type SidecarCommand = z.infer<typeof sidecarCommandSchema>;

// One stdin line: JSON text, then the command schema. Both failures come back as zod issues.
const commandLineSchema = jsonText(sidecarCommandSchema);

export const decodeSidecarCommand = (line: string): z.ZodSafeParseResult<SidecarCommand> => commandLineSchema.safeParse(line);

// One stdout line, ready to write. An invalid event throws: the supervisor never writes a line the host cannot parse.
export const encodeSidecarEvent = (event: SidecarEvent): string => `${JSON.stringify(sidecarEventSchema.parse(event))}\n`;
