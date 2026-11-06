import { Injectable } from '@nestjs/common';
import { spawn, type ChildProcess } from 'node:child_process';
import { serviceArgs, spawnedMessage, type ServiceRoute } from 'service-registry';
import { SupervisorLogger } from '../sidecar/supervisor-logger.js';
import { WebBundleService } from '../web/web-bundle.service.js';
import { ChildRegistry } from './child-registry.js';
import { forwardLines } from './forward-lines.js';
import { treeSpawnOptions } from './process-tree.js';

// Spawns one process of a service with the IPC control channel. Called again on every restart.
@Injectable()
export class ChildSpawner {
  constructor(
    private readonly web: WebBundleService,
    private readonly logger: SupervisorLogger,
    private readonly registry: ChildRegistry,
  ) {}

  spawn(route: ServiceRoute): ChildProcess {
    const bundle = route.web ? this.web.message : undefined;
    const args = bundle === undefined ? serviceArgs(route.id) : [...serviceArgs(route.id), '--web', 'ipc'];
    const child = spawn(process.execPath, args, {
      shell: false,
      // stdin stays with the supervisor: it carries the host commands. Service output is re-emitted on stderr, never on stdout.
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      serialization: 'advanced',
      ...treeSpawnOptions(),
    });
    if (child.stdout) forwardLines(route.id, child.stdout, process.stderr);
    if (child.stderr) forwardLines(route.id, child.stderr, process.stderr);
    if (child.pid !== undefined) this.registry.recordSpawn(route.id, child.pid);
    this.logger.log(spawnedMessage(route.id, child.pid));
    // The bundle is sent again on every restart, from memory.
    if (bundle !== undefined) {
      child.send(bundle, (error) => {
        if (error) this.logger.log(`web bundle handoff failed: ${error.message}`);
      });
    }
    return child;
  }
}
