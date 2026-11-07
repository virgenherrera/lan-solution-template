import type { LoggerService, LogLevel } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';
import type { LogRecord, LogResource } from '../schemas/log-record.js';
import { buildLogRecord } from './log-record-builder.js';

// The one Nest logger of an executable. It only turns each call into a record and emits it; sinks decide where and how the record is written.
export class AppLogger implements LoggerService {
  private readonly records = new Subject<LogRecord>();
  private readonly resource: LogResource;
  readonly records$: Observable<LogRecord> = this.records.asObservable();

  constructor(serviceName: string) {
    // The pid is a resource attribute and does not change for the life of the process, so it is read once here.
    this.resource = { 'service.name': serviceName, 'process.pid': process.pid };
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('fatal', message, optionalParams);
  }

  // Completes the stream; the sinks subscribed to it end.
  dispose(): void {
    this.records.complete();
  }

  private emit(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    const record = buildLogRecord({ level, args: [message, ...optionalParams], resource: this.resource, timestamp: Date.now() });
    this.records.next(record);
  }
}
