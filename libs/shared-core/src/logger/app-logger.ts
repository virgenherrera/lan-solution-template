import { inspect } from 'node:util';
import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import type { LoggerConfig } from '../schemas/logger-config.js';

type StreamName = 'stdout' | 'stderr';

// The levels that go to stderr in the cli target, as the console methods of the same names do.
const CLI_STDERR_LEVELS: ReadonlySet<LogLevel> = new Set<LogLevel>(['error', 'fatal']);

// The one Nest logger of an executable. The Nest format is never changed here, except in the cli target, which prints plain text.
export class AppLogger extends ConsoleLogger {
  constructor(private readonly config: LoggerConfig) {
    super({ prefix: config.prefix, json: config.json, colors: config.colors });
  }

  protected override printMessages(messages: unknown[], context = '', logLevel: LogLevel = 'log', writeStreamType?: StreamName, errorStack?: unknown, params?: Record<string, unknown>): void {
    if (this.config.target === 'cli') {
      this.printPlainMessages(messages, logLevel);
      return;
    }
    // The sidecar keeps stdout free: the supervisor reads its stderr, so every level goes there.
    super.printMessages(messages, context, logLevel, 'stderr', errorStack, params);
  }

  // One line per message: only the text. An install script reads these lines, so they carry no prefix, pid, date, level or context.
  private printPlainMessages(messages: unknown[], logLevel: LogLevel): void {
    const stream = this.streamOf(logLevel);
    for (const message of messages) {
      const text = typeof message === 'string' ? message : inspect(message);
      process[stream].write(`${text}\n`);
    }
  }

  private streamOf(logLevel: LogLevel): StreamName {
    return CLI_STDERR_LEVELS.has(logLevel) ? 'stderr' : 'stdout';
  }
}
