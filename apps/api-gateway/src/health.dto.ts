import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// A flag is on for "true", "1", "yes" or "on" (any case) and off for anything else; absent means `fallback`.
const TRUTHY = /^(true|1|yes|on)$/i;
const flag = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined ? fallback : TRUTHY.test(value)));

// GET /api/health query: each flag adds (memory, db), removes (uptime) or leaves the default indicator of the report. The `state` indicator is always there. Unknown query keys are stripped.
export class HealthQueryDto extends createZodDto(
  z.object({
    uptime: flag(true).describe('Set to false to remove the uptime indicator (on by default).'),
    memory: flag(false).describe('Set to true to add the memory indicator.'),
    db: flag(false).describe('Set to true to add the database indicator.'),
  }),
) {}

// One entry of info, error or details: the status plus the data the indicator adds.
const indicatorSchema = z.looseObject({ status: z.enum(['up', 'degraded', 'down']) });
const indicatorsSchema = z.record(z.string(), indicatorSchema);
const partialIndicatorsSchema = z.partialRecord(z.string(), indicatorSchema);

// GET /api/health: the standard @nestjs/terminus shape (status, info, error, details). The schema is strict so an extra top-level field makes the serializer fail with a 500 instead of being dropped.
export class HealthResponseDto extends createZodDto(
  z.strictObject({
    status: z.enum(['ok', 'error', 'degraded', 'shutting_down']),
    info: partialIndicatorsSchema.optional(),
    error: partialIndicatorsSchema.optional(),
    details: indicatorsSchema,
  }),
) {}
