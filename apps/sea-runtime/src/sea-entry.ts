import { DISPATCHER_CONFIG, SUPERVISOR_CONFIG, dispatch, serviceEntries } from 'service-registry';
import { provideLogger } from 'shared-core';
import { SERVICES } from './services.js';

// SEA entry: the dispatcher (libs/service-registry) picks the role. No --service starts the supervisor, --service <id> starts that one service, --generate-certs creates the TLS files next to the executable and exits, anything else exits with the reject code.
// `tools-cli compile-sea` (apps/tools-cli/src/sea) bundles this file and aliases the specifiers below to the built bootstraps (typed in sea-modules.d.ts).
const target = dispatch(
  process.argv.slice(2),
  serviceEntries(SERVICES).map((entry) => entry.id),
);
if (target.kind === 'rejected') {
  const logger = provideLogger({ prefix: SUPERVISOR_CONFIG.id });
  logger.error(target.message, 'SeaEntry');
  process.exit(DISPATCHER_CONFIG.rejectExitCode);
} else if (target.kind === 'service') {
  await import(`sea-services/${target.id}.js`);
} else if (target.kind === 'generate-certs') {
  const { runGenerateCerts } = await import('sea-certs-command');
  process.exitCode = runGenerateCerts();
} else {
  await import('sea-supervisor');
}
