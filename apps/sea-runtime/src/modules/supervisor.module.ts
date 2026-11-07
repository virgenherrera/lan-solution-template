import { Module } from '@nestjs/common';
import { PersistenceModule } from './persistence.module.js';
import { SidecarModule } from './sidecar.module.js';
import { WebBundleModule } from './web-bundle.module.js';
import { ChildSpawner } from '../services/child-spawner.js';
import { InMemoryChildRegistry } from '../services/in-memory-child-registry.js';
import { SeaServiceRoutes } from '../services/sea-service-routes.js';
import { ServiceLifecycleFactory } from '../services/service-lifecycle.factory.js';
import { StatusPublisher } from '../services/status-publisher.js';
import { SupervisorService } from '../services/supervisor.service.js';

@Module({
  imports: [PersistenceModule, WebBundleModule, SidecarModule],
  providers: [
    SeaServiceRoutes,
    InMemoryChildRegistry,
    ServiceLifecycleFactory,
    ChildSpawner,
    StatusPublisher,
    SupervisorService,
  ],
})
export class SupervisorModule {}
