import { z } from 'zod';

// Attribute key OpenTelemetry defines for the stack trace of an error.
export const STACKTRACE_ATTRIBUTE = 'exception.stacktrace';

const attributesSchema = z.record(z.string(), z.unknown());

// The OpenTelemetry log data model, reduced to what the executables emit.
// https://opentelemetry.io/docs/specs/otel/logs/data-model/
export const logRecordSchema = z.strictObject({
  // Epoch milliseconds, taken when the call is made.
  timestamp: z.number().int().nonnegative(),
  severityNumber: z.number().int().min(1).max(24),
  severityText: z.string().min(1),
  // The message: text, or one structured object when that is all the caller passed.
  body: z.union([z.string(), attributesSchema]),
  attributes: attributesSchema,
  // The process that emits the record.
  resource: z.strictObject({
    'service.name': z.string().min(1),
    'process.pid': z.number().int().nonnegative(),
  }),
  // The Nest context, normally the name of the class. Absent when the caller gave none.
  scope: z.strictObject({
    name: z.string().optional(),
  }),
});

export type LogRecord = z.output<typeof logRecordSchema>;
export type LogResource = LogRecord['resource'];
