import { z } from 'zod';
import { AGGREGATE_STATE, CONTROL_KIND } from './states.js';

// The five aggregate states of the runtime (REQ-RUNTIME-05).
export const aggregateStateSchema = z.enum(AGGREGATE_STATE);

export type AggregateState = z.infer<typeof aggregateStateSchema>;

// Child to supervisor: the service is listening. The supervisor knows which child sent it, so the message carries no id.
export const readyMessageSchema = z.object({ kind: z.literal(CONTROL_KIND.ready) });

// Supervisor to children: the aggregate state changed.
export const stateMessageSchema = z.object({ kind: z.literal(CONTROL_KIND.state), state: aggregateStateSchema });

// Supervisor to children: stop now. Sent by the supervisor stop sequence (2f); defined here so the contract lives in one place.
export const shutdownMessageSchema = z.object({ kind: z.literal(CONTROL_KIND.shutdown) });

// The web-bundle message (supervisor to api-gateway) keeps its own schema in api-gateway (POC-1f).
export const controlMessageSchema = z.discriminatedUnion('kind', [
  readyMessageSchema,
  stateMessageSchema,
  shutdownMessageSchema,
]);

export type ControlMessage = z.infer<typeof controlMessageSchema>;
