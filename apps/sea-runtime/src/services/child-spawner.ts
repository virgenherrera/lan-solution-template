import { Injectable } from '@nestjs/common';
import { InjectLogger, type Logger } from 'shared-core';
import { spawn, type ChildProcess } from 'node:child_process';
import { serviceArgs, spawnedMessage, type ServiceEntry } from 'service-registry';
import { WebBundleService } from './web-bundle.service.js';
import { ChildRegistry } from '../interfaces/child-registry.js';
import { treeSpawnOptions } from '../supervisor/process-tree.js';

// Spawns one process of a service with the IPC control channel. Called again on every restart.
@Injectable()
export class ChildSpawner {
  @InjectLogger() private declare readonly logger: Logger;

  constructor(
    private readonly web: WebBundleService,
    private readonly registry: ChildRegistry,
  ) {}

  spawn(route: ServiceEntry): ChildProcess {
    const bundle = route.web ? this.web.message : undefined;
    const args = bundle === undefined ? serviceArgs(route.id) : [...serviceArgs(route.id), '--web', 'ipc'];
    const child = spawn(process.execPath, args, {
      shell: false,
      // stdin stays with the supervisor: it carries the host commands. The child's stdout is not inherited because the supervisor's stdout is the event channel the host parses; its stderr is inherited and each line already carries the child's own prefix.
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      serialization: 'advanced',
      ...treeSpawnOptions(),
    });
    this.registry.recordSpawn(route.id, child.pid);
    // Registered before the lifecycle listens to the same event, so the status it publishes after an exit no longer names this pid.
    child.once('exit', () => this.registry.recordExit(route.id, child.pid));
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
