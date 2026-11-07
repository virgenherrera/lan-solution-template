import type { LoggerService } from '@nestjs/common';
import { loggerConfigSchema, type LoggerConfig, type LoggerConfigInput } from '../schemas/logger-config.js';
import { AppLogger } from './app-logger.js';
import { allToStderr, consoleSink, errorsToStderr } from './console-sink.js';
import { formatJson, formatNestText, formatPlain, type RecordFormatter } from './formatters.js';

function formatterOf(config: LoggerConfig): RecordFormatter {
  if (config.target === 'cli') {
    return formatPlain;
  }
  return config.json ? formatJson : formatNestText;
}

function streamOf(config: LoggerConfig) {
  return config.target === 'cli' ? errorsToStderr : allToStderr;
}

// Validates the input with the schema (defaults included) and returns the logger. Pass it to `NestFactory` as `{ logger }`, or call it directly where no Nest app exists. An invalid input throws the ZodError as is.
export function provideLogger(input: LoggerConfigInput): LoggerService {
  const config = loggerConfigSchema.parse(input);
  const logger = new AppLogger(config.prefix);
  // The process streams are the default writers only here; everything below receives them as parameters.
  consoleSink(logger.records$, {
    format: formatterOf(config),
    streamOf: streamOf(config),
    writers: { stdout: process.stdout, stderr: process.stderr },
  });
  return logger;
}
