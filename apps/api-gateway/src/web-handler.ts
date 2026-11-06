import type { IncomingMessage, ServerResponse } from 'node:http';
import { API_PREFIX } from './api-prefix.js';
import type { WebBundle } from './web-bundle.js';

const INDEX = 'index.html';
const API_ROUTE = `/${API_PREFIX}`;
// Angular names built files "<name>-<8 character hash>.<ext>" (letters of both cases, digits, `_` and `-`); such a name changes whenever the content does.
const CONTENT_HASHED = /-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;
// Entry points the browser must revalidate on every load, or an update (or a stale service worker) would stick.
const NEVER_CACHED = new Set([INDEX, 'ngsw-worker.js', 'ngsw.json', 'manifest.webmanifest', 'safety-worker.js', 'worker-basic.min.js']);
// A last path segment with a dot names a file, not an SPA route.
const HAS_EXTENSION = /\.[^/.]+$/;

// Hashed files are immutable; everything else (the never-cached names and any unknown file) is revalidated, the safe default.
export function cacheControlOf(path: string): string {
  return !NEVER_CACHED.has(path) && CONTENT_HASHED.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache';
}

type Next = (error?: unknown) => void;

// Connect-style middleware that serves the in-memory web bundle: GET and HEAD only, exact file match first,
// then index.html for any other extension-less path outside /api (SPA routes). A missing file with an extension is a 404, never index.html.
// Paths under /api are never answered here: they go to the API, which owns their 404.
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
    // Lower-cased: the router matches /API/x as an API route too, so it must not get index.html.
    const route = pathname.toLowerCase();
    if (route === API_ROUTE || route.startsWith(`${API_ROUTE}/`)) return next();

    const requested = pathname.slice(1);
    const hit = bundle.get(requested);
    if (hit === undefined && HAS_EXTENSION.test(pathname)) {
      res.writeHead(404, { 'Content-Length': 0 }).end();
      return;
    }
    const key = hit === undefined ? INDEX : requested;
    const entry = hit ?? bundle.get(INDEX);
    if (entry === undefined) return next();

    const cacheControl = cacheControlOf(key);
    res.writeHead(200, {
      'Content-Type': entry.contentType,
      'Content-Length': entry.bytes.byteLength,
      'Cache-Control': cacheControl,
    });
    res.end(method === 'HEAD' ? undefined : entry.bytes);
  };
}
