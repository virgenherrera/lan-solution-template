import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { SidecarModule } from '../sidecar/sidecar.module.js';
import { WebBundleModule } from '../web/web-bundle.module.js';
import { ChildSpawner } from './child-spawner.js';
import { Clock } from './clock.js';
import { Random } from './random.js';
import { SeaServiceRoutes } from './sea-service-routes.js';
import { ServiceLifecycleFactory } from './service-lifecycle.factory.js';
import { ServiceRoutes } from './service-routes.js';
import { StatusPublisher } from './status-publisher.js';
import { SupervisorService } from './supervisor.service.js';
import { SystemClock } from './system-clock.js';
import { SystemRandom } from './system-random.js';

@Module({
  imports: [PersistenceModule, WebBundleModule, SidecarModule],
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: Random, useClass: SystemRandom },
    { provide: ServiceRoutes, useClass: SeaServiceRoutes },
    ServiceLifecycleFactory,
    ChildSpawner,
    StatusPublisher,
    SupervisorService,
  ],
})
export class SupervisorModule {}
