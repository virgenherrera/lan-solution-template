import type { LogLevel } from '@nestjs/common';

export interface LogSeverity {
  readonly number: number;
  readonly text: string;
}

// OpenTelemetry defines the ranges (TRACE 1-4, DEBUG 5-8, INFO 9-12, WARN 13-16, ERROR 17-20, FATAL 21-24) but not a mapping for the Nest levels.
// This table is our own decision, not part of the specification: each Nest level takes the first number of the range it is closest to.
export const LOG_SEVERITY = {
  fatal: { number: 21, text: 'FATAL' },
  error: { number: 17, text: 'ERROR' },
  warn: { number: 13, text: 'WARN' },
  log: { number: 9, text: 'INFO' },
  debug: { number: 5, text: 'DEBUG' },
  verbose: { number: 1, text: 'TRACE' },
} as const satisfies Record<LogLevel, LogSeverity>;
