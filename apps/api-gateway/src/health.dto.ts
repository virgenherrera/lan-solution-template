import { createZodDto } from 'nestjs-zod';
import { aggregateStateSchema } from 'service-registry';
import { z } from 'zod';

// GET /api/health: only the aggregate state. The schema is strict: the serializer validates the response, so an extra field makes it fail with a 500 instead of being dropped (a z.object schema would strip it).
export class HealthResponseDto extends createZodDto(z.strictObject({ status: aggregateStateSchema })) {}
