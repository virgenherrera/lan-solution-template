import { Inject, Injectable } from '@nestjs/common';
import { SUPERVISOR_CONFIG, type ServiceRoute } from 'service-registry';
import { ServiceLifecycle, type LifecycleHooks } from './service-lifecycle.js';
import { CLOCK, RANDOM } from './tokens.js';

@Injectable()
export class ServiceLifecycleFactory {
  constructor(
    @Inject(CLOCK) private readonly now: () => number,
    @Inject(RANDOM) private readonly random: () => number,
  ) {}

  create(route: ServiceRoute, hooks: LifecycleHooks): ServiceLifecycle {
    return new ServiceLifecycle(route.id, hooks, SUPERVISOR_CONFIG, this.random, this.now);
  }
}
