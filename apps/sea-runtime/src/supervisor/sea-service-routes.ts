import { Injectable } from '@nestjs/common';
import { type ServiceRoute } from 'service-registry';
import { ServiceRoutes } from './service-routes.js';
import { loadServiceRoutes } from './service-routes-source.js';

@Injectable()
export class SeaServiceRoutes extends ServiceRoutes {
  load(): readonly ServiceRoute[] {
    return loadServiceRoutes();
  }
}
