import type { LoggerService } from '@nestjs/common';
import { loggerConfigSchema, type LoggerConfigInput } from '../schemas/logger-config.js';
import { AppLogger } from './app-logger.js';

// Validates the input with the schema (defaults included) and returns the logger that `NestFactory` takes as `{ logger }` and `Logger.overrideLogger` takes as its argument. An invalid input throws the ZodError as is.
export function provideLogger(input: LoggerConfigInput): LoggerService {
  return new AppLogger(loggerConfigSchema.parse(input));
}
