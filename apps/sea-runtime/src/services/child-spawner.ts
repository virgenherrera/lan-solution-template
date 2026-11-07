import { Injectable } from '@nestjs/common';
import { InjectLogger, type Logger } from 'shared-core';
import { spawn, type ChildProcess } from 'node:child_process';
import { serviceArgs, spawnedMessage, type ServiceEntry } from 'service-registry';
import { WebBundleService } from './web-bundle.service.js';
import { InMemoryChildRegistry } from './in-memory-child-registry.js';
import { treeSpawnOptions } from '../supervisor/process-tree.js';

// Spawns one process of a service with the IPC control channel. Called again on every restart.
@Injectable()
export class ChildSpawner {
  @InjectLogger() private declare readonly logger: Logger;

  constructor(
    private readonly web: WebBundleService,
    private readonly registry: InMemoryChildRegistry,
  ) {}

  spawn(route: ServiceEntry): ChildProcess {
    const bundle = route.web ? this.web.message : undefined;
    const child = spawn(process.execPath, serviceArgs({ id: route.id, web: route.web }), {
      shell: false,
      // The supervisor's stdout is the event channel, so the child's stdout is not inherited.
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      serialization: 'advanced',
      ...treeSpawnOptions(),
    });
    this.registry.recordSpawn(route.id, child.pid);
    // Registered before the lifecycle listens to the same event, so the status it publishes after an exit no longer names this pid.
    child.once('exit', () => this.registry.recordExit(route.id, child.pid));
    this.logger.log(spawnedMessage(route.id, child.pid));
    if (bundle !== undefined) {
      child.send(bundle, (error) => {
        if (error) this.logger.log(`web bundle handoff failed: ${error.message}`);
      });
    }
    return child;
  }
}
