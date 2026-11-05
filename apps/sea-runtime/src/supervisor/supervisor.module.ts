import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { SidecarModule } from '../sidecar/sidecar.module.js';
import { WebBundleModule } from '../web/web-bundle.module.js';
import { ChildSpawner } from './child-spawner.js';
import { ServiceLifecycleFactory } from './service-lifecycle.factory.js';
import { loadServiceRoutes } from './service-routes-source.js';
import { StatusPublisher } from './status-publisher.js';
import { SupervisorService } from './supervisor.service.js';
import { CLOCK, RANDOM, SERVICE_ROUTES } from './tokens.js';

@Module({
  imports: [PersistenceModule, WebBundleModule, SidecarModule],
  providers: [
    // TD: CLOCK, RANDOM and SERVICE_ROUTES use a Symbol token with useValue/useFactory. They must become
    // injectable classes, as in nest-base. Tracked in docs/backlog/td-nest-di-by-class.md (refactor branch).
    { provide: CLOCK, useValue: Date.now },
    { provide: RANDOM, useValue: Math.random },
    { provide: SERVICE_ROUTES, useFactory: loadServiceRoutes },
    ServiceLifecycleFactory,
    ChildSpawner,
    StatusPublisher,
    SupervisorService,
  ],
})
export class SupervisorModule {}
