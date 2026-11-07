import { Injectable } from '@nestjs/common';
import { type ServiceEntry } from 'service-registry';
import { loadServiceRoutes } from '../supervisor/service-routes-source.js';

@Injectable()
export class SeaServiceRoutes {
  load(): readonly ServiceEntry[] {
    return loadServiceRoutes();
  }
}
