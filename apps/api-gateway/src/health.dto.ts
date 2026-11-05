import { createZodDto } from 'nestjs-zod';
import { aggregateStateSchema } from 'service-registry';
import { z } from 'zod';

// GET /api/health: only the aggregate state. Declaring it makes the serializer drop any other field.
export class HealthResponseDto extends createZodDto(z.strictObject({ status: aggregateStateSchema })) {}
