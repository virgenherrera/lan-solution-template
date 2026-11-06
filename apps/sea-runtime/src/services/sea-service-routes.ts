import { Injectable } from '@nestjs/common';
import { type ServiceEntry } from 'service-registry';
import { ServiceRoutes } from '../interfaces/service-routes.js';
import { loadServiceRoutes } from '../supervisor/service-routes-source.js';

@Injectable()
export class SeaServiceRoutes extends ServiceRoutes {
  load(): readonly ServiceEntry[] {
    return loadServiceRoutes();
  }
}
