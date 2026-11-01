import { type ServiceDefinition } from './service-definition.js';

// Pure function: service ids ordered so every service comes after the ones it depends on.
// Only enabled services count. Ties keep registry order. Throws on a cycle.
// Verified with one service only; ordering of two or more services is not verified.
export function startupOrder(
  services: readonly Pick<ServiceDefinition, 'id' | 'dependsOn' | 'enabled'>[],
): string[] {
  const enabled = services.filter((service) => service.enabled);
  const ids = new Set(enabled.map((service) => service.id));
  const ordered: string[] = [];
  const visiting = new Set<string>();
  const visit = (id: string): void => {
    if (ordered.includes(id)) return;
    if (visiting.has(id)) throw new Error(`dependency cycle at service "${id}"`);
    visiting.add(id);
    const service = enabled.find((candidate) => candidate.id === id);
    for (const dependency of service?.dependsOn ?? []) {
      if (ids.has(dependency)) visit(dependency);
    }
    visiting.delete(id);
    ordered.push(id);
  };
  for (const service of enabled) visit(service.id);
  return ordered;
}
