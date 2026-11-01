import { z } from 'zod';

const RECEIVE_TIMEOUT_MS = 10_000;

// A relative, normalized path: no leading slash, no backslash, no "." or ".." segment.
const relativePath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith('/') && !p.includes('\\') && p.split('/').every((s) => s !== '' && s !== '.' && s !== '..'), {
    message: 'path must be relative and free of "." and ".." segments',
  });

// The one IPC message a parent process may send: every file of the web bundle.
export const webBundleMessageSchema = z.object({
  kind: z.literal('web-bundle'),
  files: z.array(z.object({ path: relativePath, bytes: z.instanceof(Uint8Array) })).min(1),
});

export interface WebEntry {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export type WebBundle = ReadonlyMap<string, WebEntry>;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  txt: 'text/plain; charset=utf-8',
  map: 'application/json; charset=utf-8',
  webmanifest: 'application/manifest+json; charset=utf-8',
};

export function contentTypeOf(path: string): string {
  const dot = path.lastIndexOf('.');
  const ext = dot === -1 ? '' : path.slice(dot + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

export function toWebBundle(message: z.infer<typeof webBundleMessageSchema>): WebBundle {
  return new Map(
    message.files.map(({ path, bytes }) => [path, Object.freeze({ bytes, contentType: contentTypeOf(path) })]),
  );
}

// Waits for exactly one valid web-bundle message from the parent. The channel stays open afterwards: the supervisor sends state messages over it.
// Fails fast with a clear error when there is no channel, the message is invalid, or nothing arrives in time.
export function receiveWebBundle(timeoutMs: number = RECEIVE_TIMEOUT_MS): Promise<WebBundle> {
  return new Promise((resolve, reject) => {
    if (process.send === undefined) {
      reject(new Error('--web ipc needs an IPC channel from the parent process, but there is none'));
      return;
    }
    const finish = (): void => {
      clearTimeout(timer);
      process.off('message', onMessage);
      process.off('disconnect', onDisconnect);
    };
    const onMessage = (raw: unknown): void => {
      finish();
      const parsed = webBundleMessageSchema.safeParse(raw);
      if (!parsed.success) {
        reject(new Error(`invalid web bundle message: ${parsed.error.message}`));
        return;
      }
      resolve(toWebBundle(parsed.data));
    };
    const onDisconnect = (): void => {
      finish();
      reject(new Error('parent closed the IPC channel before sending the web bundle'));
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error(`no web bundle received within ${timeoutMs} ms`));
    }, timeoutMs);
    process.on('message', onMessage);
    process.on('disconnect', onDisconnect);
  });
}
