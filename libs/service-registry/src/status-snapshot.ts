import { z } from 'zod';
import { aggregateStateSchema } from './control-channel.js';
import { SERVICE_STATUS } from './states.js';

export const serviceStatusSchema = z.enum(SERVICE_STATUS);

// What the supervisor answers on its status endpoint: the aggregate state plus one status per service. Consumers read it, none derives it.
export const statusSnapshotSchema = z.object({
  state: aggregateStateSchema,
  services: z.array(z.object({ id: z.string().min(1), status: serviceStatusSchema })),
});
