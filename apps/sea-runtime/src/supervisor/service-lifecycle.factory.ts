import { Inject, Injectable } from '@nestjs/common';
import { SUPERVISOR_CONFIG, type ServiceEntry } from 'service-registry';
import { ServiceLifecycle, type LifecycleHooks } from './service-lifecycle.js';
import { Clock } from './clock.js';
import { Random } from './random.js';

@Injectable()
export class ServiceLifecycleFactory {
  constructor(
    @Inject(Clock) private readonly clock: Clock,
    @Inject(Random) private readonly random: Random,
  ) {}

  create(route: ServiceEntry, hooks: LifecycleHooks): ServiceLifecycle {
    return new ServiceLifecycle(route.id, hooks, SUPERVISOR_CONFIG, () => this.random.next(), () => this.clock.now());
  }
}
