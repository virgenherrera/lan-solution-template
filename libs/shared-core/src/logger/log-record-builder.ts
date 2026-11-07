import { LOG_SEVERITY } from '../constants/log-severity.js';
import { STACKTRACE_ATTRIBUTE, logRecordSchema, type LogRecord, type LogResource } from '../schemas/log-record.js';
import type { LogLevel } from '@nestjs/common';

export interface BuildLogRecordInput {
  readonly level: LogLevel;
  // What the caller passed: the message first, then Nest's optional params.
  readonly args: readonly unknown[];
  readonly resource: LogResource;
  readonly timestamp: number;
}

// The three parts the Nest convention extracts from the arguments.
interface ParsedArgs {
  readonly messages: unknown[];
  readonly context?: string | undefined;
  readonly params: Record<string, unknown>;
  readonly stack?: string | undefined;
}

// Same test as Nest's isPlainObject: an object whose prototype is Object.prototype or null. An Error, a Map or a class instance is not plain.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

// Same test as ConsoleLogger.isStackFormat: a newline followed by an "at file:line:column" frame.
const STACK_FORMAT = /\n[ \t]+at .+:\d+:\d+/;

function isStackFormat(value: unknown): boolean {
  return typeof value === 'string' && STACK_FORMAT.test(value);
}

// ConsoleLogger.getContextAndMessagesToPrint: with more than one argument, a last string is the context; plain objects after the message are structured params.
function parseMessages(args: readonly unknown[]): Omit<ParsedArgs, 'stack'> {
  if (args.length <= 1) {
    return { messages: [...args], params: {} };
  }
  const last = args[args.length - 1];
  const hasContext = typeof last === 'string';
  const remaining = hasContext ? args.slice(0, -1) : args;
  const [message, ...rest] = remaining;
  const messages: unknown[] = [message, ...rest.filter((arg) => !isPlainObject(arg))];
  const params = Object.assign({}, ...rest.filter(isPlainObject));
  return { messages, context: hasContext ? last : undefined, params };
}

// ConsoleLogger.getContextAndStackAndMessagesToPrint, rule by rule, for the error and fatal levels.
function parseWithStack(args: readonly unknown[]): ParsedArgs {
  if (args.length === 1) {
    return parseMessages(args);
  }
  if (args.length === 2) {
    return parseTwoArgs(args);
  }
  const trailing = args[args.length - 1];
  if (isStackFormat(trailing)) {
    return { ...parseMessages(args.slice(0, -1)), stack: trailing as string };
  }
  const parsed = parseMessages(args);
  const last = parsed.messages[parsed.messages.length - 1];
  const lastIsStack = typeof last === 'string' || last === undefined;
  if (parsed.messages.length <= 1 || !lastIsStack) {
    return parsed;
  }
  return { ...parsed, messages: parsed.messages.slice(0, -1), stack: last };
}

// Two arguments: the second is a stack when it looks like one or is undefined; otherwise it is a context.
function parseTwoArgs(args: readonly unknown[]): ParsedArgs {
  const second = args[1];
  if (isStackFormat(second) || second === undefined) {
    return { messages: [args[0]], params: {}, stack: second as string | undefined };
  }
  return parseMessages(args);
}

// An Error contributes its message to the body and its stack to the stack trace.
function textOf(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message instanceof Error) {
    return message.message;
  }
  return JSON.stringify(message) ?? String(message);
}

// One structured object is kept as the body; anything else becomes text, one line per message like Nest prints it.
function bodyOf(messages: readonly unknown[]): LogRecord['body'] {
  const [only] = messages;
  if (messages.length === 1 && isPlainObject(only)) {
    return only as Record<string, unknown>;
  }
  return messages.map(textOf).join('\n');
}

function stackOf(parsed: ParsedArgs): string | undefined {
  const fromError = parsed.messages.find((message): message is Error => message instanceof Error);
  return parsed.stack ?? fromError?.stack;
}

// The only place that knows the Nest argument convention. Pure: the clock and the process data come in as input.
export function buildLogRecord(input: BuildLogRecordInput): LogRecord {
  const withStack = input.level === 'error' || input.level === 'fatal';
  const parsed = withStack ? parseWithStack(input.args) : parseMessages(input.args);
  const stack = stackOf(parsed);
  const severity = LOG_SEVERITY[input.level];
  return logRecordSchema.parse({
    timestamp: input.timestamp,
    severityNumber: severity.number,
    severityText: severity.text,
    body: bodyOf(parsed.messages),
    attributes: stack === undefined ? parsed.params : { ...parsed.params, [STACKTRACE_ATTRIBUTE]: stack },
    resource: input.resource,
    scope: { name: parsed.context },
  });
}
