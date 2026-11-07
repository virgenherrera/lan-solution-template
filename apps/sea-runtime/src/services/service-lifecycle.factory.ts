import { Injectable } from '@nestjs/common';
import { SUPERVISOR_CONFIG, type ServiceEntry } from 'service-registry';
import { ServiceLifecycle, type LifecycleHooks } from './service-lifecycle.js';

@Injectable()
export class ServiceLifecycleFactory {
  create(route: ServiceEntry, hooks: LifecycleHooks): ServiceLifecycle {
    return new ServiceLifecycle(route.id, hooks, SUPERVISOR_CONFIG);
  }
}
