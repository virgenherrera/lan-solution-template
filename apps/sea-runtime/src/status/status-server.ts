import { createServer, type Server } from 'node:http';
import { statusSnapshotSchema, type StatusSnapshot } from 'service-registry';

export const STATUS_PATH = '/status';

// The supervisor answers here while any service, the gateway included, restarts. Loopback only, read only, one route.
export class StatusServer {
  private server?: Server;

  constructor(private readonly snapshot: () => StatusSnapshot) {}

  // Resolves with an error instead of throwing: a busy port must not take the runtime down.
  listen(port: number): Promise<Error | undefined> {
    return new Promise((resolve) => {
      const server = createServer((req, res) => {
        if (req.method !== 'GET' || req.url !== STATUS_PATH) {
          res.writeHead(404).end();
          return;
        }
        const body = JSON.stringify(statusSnapshotSchema.parse(this.snapshot()));
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(body);
      });
      server.once('error', (error) => resolve(error));
      server.listen(port, '127.0.0.1', () => {
        server.removeAllListeners('error');
        this.server = server;
        resolve(undefined);
      });
    });
  }

  close(): Promise<void> {
    const { server } = this;
    this.server = undefined;
    return new Promise((resolve) => (server === undefined ? resolve() : server.close(() => resolve())));
  }
}
