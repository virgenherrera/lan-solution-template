import { inspect } from 'node:util';
import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { prefixed } from 'service-registry';

// The context of a line that prints as plain text, for code that has no service id of its own.
export const PLAIN_CONTEXT = 'raw';

export interface ServiceLoggerOptions {
  // Contexts that print one plain line per message.
  readonly plainContexts: ReadonlySet<string>;
  // true: `[context] text`; false: `text`.
  readonly plainPrefix: boolean;
  // true: any other context prints in the normal Nest format; false: it is dropped.
  readonly nest: boolean;
  // 'stderr': every level to stderr; 'by-level': log, warn, debug and verbose to stdout, error and fatal to stderr, as `console.*` does. Default 'stderr'.
  readonly stream?: 'stderr' | 'by-level';
}

type StreamName = 'stdout' | 'stderr';

// The one Nest logger of the executable. Install it with `Logger.overrideLogger`, then every class uses `new Logger(context)`.
// A plain line skips `updateAndGetTimestampDiff`, so it does not move the `+Nms` of the Nest lines, as a raw write did not.
export class ServiceLogger extends ConsoleLogger {
  constructor(private readonly serviceOptions: ServiceLoggerOptions) {
    super({ timestamp: true });
  }

  protected override printMessages(messages: unknown[], context = '', logLevel: LogLevel = 'log', writeStreamType?: StreamName, errorStack?: unknown, params?: Record<string, unknown>): void {
    const stream = this.serviceOptions.stream === 'by-level' ? (writeStreamType ?? 'stdout') : 'stderr';
    if (this.serviceOptions.plainContexts.has(context)) {
      for (const message of messages) {
        const text = typeof message === 'string' ? message : inspect(message);
        process[stream].write(`${this.serviceOptions.plainPrefix ? prefixed(context, text) : text}\n`);
      }
      return;
    }
    if (this.serviceOptions.nest) super.printMessages(messages, context, logLevel, stream, errorStack, params);
  }
}
