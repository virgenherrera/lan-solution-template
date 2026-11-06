import { Module } from '@nestjs/common';
import { PersistenceModule } from './persistence.module.js';
import { SidecarModule } from './sidecar.module.js';
import { WebBundleModule } from './web-bundle.module.js';
import { ChildRegistry } from '../interfaces/child-registry.js';
import { ChildSpawner } from '../services/child-spawner.js';
import { Clock } from '../interfaces/clock.js';
import { InMemoryChildRegistry } from '../services/in-memory-child-registry.js';
import { Random } from '../interfaces/random.js';
import { SeaServiceRoutes } from '../services/sea-service-routes.js';
import { ServiceLifecycleFactory } from '../services/service-lifecycle.factory.js';
import { ServiceRoutes } from '../interfaces/service-routes.js';
import { StatusPublisher } from '../services/status-publisher.js';
import { SupervisorService } from '../services/supervisor.service.js';
import { SystemClock } from '../services/system-clock.js';
import { SystemRandom } from '../services/system-random.js';

@Module({
  imports: [PersistenceModule, WebBundleModule, SidecarModule],
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: Random, useClass: SystemRandom },
    { provide: ServiceRoutes, useClass: SeaServiceRoutes },
    { provide: ChildRegistry, useClass: InMemoryChildRegistry },
    ServiceLifecycleFactory,
    ChildSpawner,
    StatusPublisher,
    SupervisorService,
  ],
})
export class SupervisorModule {}
