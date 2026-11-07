import { inspect } from 'node:util';
import { STACKTRACE_ATTRIBUTE, type LogRecord } from '../schemas/log-record.js';

export type RecordFormatter = (record: LogRecord) => string;

const LEVEL_WIDTH = 7;

function messageOf(record: LogRecord): string {
  return typeof record.body === 'string' ? record.body : inspect(record.body, { compact: true, breakLength: Infinity });
}

// The attributes without the stack trace, which prints on its own lines.
function extraAttributesOf(record: LogRecord): Record<string, unknown> {
  const { [STACKTRACE_ATTRIBUTE]: _stack, ...extra } = record.attributes;
  return extra;
}

function attributesText(record: LogRecord): string {
  const extra = extraAttributesOf(record);
  if (Object.keys(extra).length === 0) {
    return '';
  }
  return ` ${inspect(extra, { compact: true, breakLength: Infinity })}`;
}

function stackText(record: LogRecord): string {
  const stack = record.attributes[STACKTRACE_ATTRIBUTE];
  return typeof stack === 'string' ? `\n${stack}` : '';
}

function scopeText(record: LogRecord): string {
  return record.scope.name === undefined ? '' : ` [${record.scope.name}]`;
}

// The Nest text layout with an ISO 8601 UTC timestamp:
// [service] pid  - 2026-11-06T10:00:00.000Z     INFO [Scope] message {attributes}
export function formatNestText(record: LogRecord): string {
  const service = record.resource['service.name'];
  const pid = record.resource['process.pid'];
  const time = new Date(record.timestamp).toISOString();
  const level = record.severityText.padStart(LEVEL_WIDTH);
  return `[${service}] ${pid}  - ${time}  ${level}${scopeText(record)} ${messageOf(record)}${attributesText(record)}${stackText(record)}`;
}

// One JSON object per line. The keys are the ones of the record.
export function formatJson(record: LogRecord): string {
  return JSON.stringify(record, (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value));
}

// Only the message. An install script reads these lines, so they carry no prefix, pid, date, level or scope.
export function formatPlain(record: LogRecord): string {
  return messageOf(record);
}
