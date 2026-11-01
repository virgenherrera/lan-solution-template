import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WebBundle } from './web-bundle.js';

const INDEX = 'index.html';
const API_PREFIX = '/api';
// Angular names built files "<name>-<8 upper-case alphanumerics>.<ext>"; such a name changes whenever the content does. Assumption: this build tool only.
const CONTENT_HASHED = /-[A-Z0-9]{8}\.[A-Za-z0-9]+$/;

type Next = (error?: unknown) => void;

// Connect-style middleware that serves the in-memory web bundle: GET and HEAD only, exact file match first,
// then index.html for any other path outside /api (SPA routes). Paths under /api are never answered here.
export function createWebHandler(bundle: WebBundle) {
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';
    if (method !== 'GET' && method !== 'HEAD') return next();

    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)) return next();

    const requested = pathname.slice(1);
    const hit = bundle.get(requested);
    const key = hit === undefined ? INDEX : requested;
    const entry = hit ?? bundle.get(INDEX);
    if (entry === undefined) return next();

    const cacheControl =
      key !== INDEX && CONTENT_HASHED.test(key) ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, {
      'Content-Type': entry.contentType,
      'Content-Length': entry.bytes.byteLength,
      'Cache-Control': cacheControl,
    });
    res.end(method === 'HEAD' ? undefined : entry.bytes);
  };
}
