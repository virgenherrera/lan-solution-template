import { Inject, Injectable, type BeforeApplicationShutdown, type OnApplicationBootstrap } from '@nestjs/common';
import { isSea } from 'node:sea';
import { AGGREGATE_STATE, EXIT_CODE, SUPERVISOR_CONFIG, startupOrder, type ServiceRoute } from 'service-registry';
import { PersistenceService } from '../persistence/persistence.service.js';
import { SidecarInput } from '../sidecar/sidecar-input.js';
import { SupervisorLogger } from '../sidecar/supervisor-logger.js';
import { ChildSpawner } from './child-spawner.js';
import { ServiceLifecycleFactory } from './service-lifecycle.factory.js';
import { type ServiceLifecycle } from './service-lifecycle.js';
import { stopTree } from './process-tree.js';
import { StatusPublisher } from './status-publisher.js';
import { ServiceRoutes } from './service-routes.js';

// Orchestration only: starts the services in order, stops them in reverse order, and turns every reason to stop into the same shutdown.
@Injectable()
export class SupervisorService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly services: ServiceLifecycle[] = [];
  private shutdownRun?: Promise<void>;

  constructor(
    @Inject(ServiceRoutes) private readonly routes: ServiceRoutes,
    private readonly persistence: PersistenceService,
    private readonly spawner: ChildSpawner,
    private readonly lifecycles: ServiceLifecycleFactory,
    private readonly status: StatusPublisher,
    private readonly input: SidecarInput,
    private readonly logger: SupervisorLogger,
  ) {}

  onApplicationBootstrap(): void {
    // Dev (`nest start`): same persistence path. No service is spawned because there is no SEA binary to spawn.
    if (!isSea()) {
      this.logger.log('not running as a SEA executable; spawning no services');
      return;
    }
    // A `shutdown` command is the only command today. A closed stdin means the host is gone, which means the same.
    this.input.listen().subscribe({
      next: () => void this.shutdown('shutdown command', 0),
      complete: () => void this.shutdown('end of stdin', 0),
    });
    for (const route of this.startOrder()) {
      const lifecycle = this.lifecycles.create(route, {
        spawn: () => this.spawner.spawn(route),
        onStatus: () => this.refresh(),
        log: (text) => this.logger.log(text),
      });
      this.services.push(lifecycle);
      lifecycle.start();
    }
    this.refresh();
  }

  // Nest calls this on SIGINT and SIGTERM (enableShutdownHooks).
  beforeApplicationShutdown(signal?: string): Promise<void> {
    return this.shutdown(signal ?? 'shutdown', EXIT_CODE.ok);
  }

  private startOrder(): ServiceRoute[] {
    const routes = this.routes.load();
    const byId = new Map(routes.map((route) => [route.id, route]));
    return startupOrder(routes).flatMap((id) => byId.get(id) ?? []);
  }

  private refresh(): void {
    if (this.status.publish(this.services) === AGGREGATE_STATE.error) void this.shutdown('state error', SUPERVISOR_CONFIG.errorExitCode);
  }

  // Idempotent: every caller waits for the same run, which ends the process.
  private shutdown(reason: string, exitCode: number): Promise<void> {
    this.shutdownRun ??= this.stopAll(reason, exitCode);
    return this.shutdownRun;
  }

  // Stops every child in reverse startup order (shutdown message, timeout, tree kill), closes the database, then ends the supervisor.
  private async stopAll(reason: string, exitCode: number): Promise<void> {
    this.logger.log(`received ${reason}; stopping ${this.services.length} service(s)`);
    this.status.markStopping();
    this.refresh();
    for (const service of [...this.services].reverse()) {
      service.stop();
      if (service.child !== undefined) await stopTree(service.id, service.child, SUPERVISOR_CONFIG, (text) => this.logger.log(text));
    }
    await this.persistence.close();
    process.exit(exitCode);
  }
}
