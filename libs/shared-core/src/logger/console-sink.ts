import { map, tap, type Observable, type Subscription } from 'rxjs';
import { LOG_SEVERITY } from '../constants/log-severity.js';
import type { LogRecord } from '../schemas/log-record.js';
import type { RecordFormatter } from './formatters.js';

// What a sink writes to. The process streams satisfy it; a test can pass any object with write().
export interface TextWriter {
  write(text: string): unknown;
}

export interface SinkWriters {
  readonly stdout: TextWriter;
  readonly stderr: TextWriter;
}

export type SinkTarget = keyof SinkWriters;

export interface ConsoleSinkOptions {
  readonly format: RecordFormatter;
  readonly streamOf: (record: LogRecord) => SinkTarget;
  readonly writers: SinkWriters;
}

// The sidecar keeps stdout free: the supervisor reads its stderr, so every level goes there.
export function allToStderr(): SinkTarget {
  return 'stderr';
}

// The cli target splits like the console methods do: error and fatal on stderr, the rest on stdout.
export function errorsToStderr(record: LogRecord): SinkTarget {
  return record.severityNumber >= LOG_SEVERITY.error.number ? 'stderr' : 'stdout';
}

// The records are formatted and written in the order they are emitted, synchronously, so a line is never lost to a process.exit right after the call.
export function consoleSink(records$: Observable<LogRecord>, options: ConsoleSinkOptions): Subscription {
  return records$
    .pipe(
      map((record) => ({ line: `${options.format(record)}\n`, target: options.streamOf(record) })),
      tap(({ line, target }) => options.writers[target].write(line)),
    )
    .subscribe();
}

// Extension note, not implemented: a disk sink is another pipeline over the same records$.
//   records$.pipe(
//     bufferTime(flushMs, null, maxBatch),        // group lines; maxBatch bounds the memory
//     filter((batch) => batch.length > 0),
//     concatMap((batch) => write(batch)),          // one write at a time keeps the order
//     scan((bytes, written) => bytes + written, 0), // running size of the file
//   )
// When the size passes the limit, rotate the file. On shutdown call dispose() and wait for the last write, or the pending batch is lost.
