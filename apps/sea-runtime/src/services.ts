import { defineServices } from 'service-registry';

// Every service the supervisor runs. Add an entry to supervise a new one; `project` defaults to the id.
export const SERVICES = defineServices([{ id: 'api-gateway', web: true }]);
