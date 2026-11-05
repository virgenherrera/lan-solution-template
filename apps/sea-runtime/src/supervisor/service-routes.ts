import { type ServiceRoute } from 'service-registry';

// The routes the supervisor runs: the services asset in a SEA build, the typed array in dev.
export abstract class ServiceRoutes {
  abstract load(): readonly ServiceRoute[];
}
