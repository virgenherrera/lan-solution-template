import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export interface RedirectInput {
  readonly host: string | undefined;
  readonly url: string | undefined;
  // The names the TLS identity covers: the only hosts this listener may send a browser to.
  readonly names: { readonly dnsNames: readonly string[]; readonly ipAddresses: readonly string[] };
  readonly httpsPort: number;
}

// Host header without its port, lower-cased; undefined when it is missing or malformed.
function hostnameOf(host: string | undefined): string | undefined {
  if (host === undefined) return undefined;
  const value = host.toLowerCase();
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end < 0 || !/^(:\d{1,5})?$/.test(value.slice(end + 1))) return undefined;
    return value.slice(1, end);
  }
  const parts = value.split(':');
  // More than one colon without brackets is not a valid host:port.
  if (parts.length > 2 || (parts[1] !== undefined && !/^\d{1,5}$/.test(parts[1]))) return undefined;
  return parts[0] === '' ? undefined : parts[0];
}

// The HTTPS location for a request, or undefined when it must be refused. The Host header is never echoed unless the identity covers it, and the path must be origin-form, so no request can turn this into an open redirect.
export function redirectTarget({ host, url, names, httpsPort }: RedirectInput): string | undefined {
  const name = hostnameOf(host);
  if (name === undefined || url === undefined || !url.startsWith('/') || url.startsWith('//')) return undefined;
  const isIp = names.ipAddresses.some((ip) => ip.toLowerCase() === name);
  if (!isIp && !names.dnsNames.some((dns) => dns.toLowerCase() === name)) return undefined;
  const authority = name.includes(':') ? `[${name}]` : name;
  return `https://${authority}:${httpsPort}${url}`;
}

// Plain-HTTP listener that only redirects to HTTPS: it serves no content and reads no request body.
export function createRedirectServer(options: Pick<RedirectInput, 'names' | 'httpsPort'>): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Length': 0 }).end();
      return;
    }
    const location = redirectTarget({ host: req.headers.host, url: req.url, ...options });
    if (location === undefined) {
      res.writeHead(400, { 'Content-Length': 0 }).end();
      return;
    }
    res.writeHead(308, { Location: location, 'Content-Length': 0 }).end();
  });
}
