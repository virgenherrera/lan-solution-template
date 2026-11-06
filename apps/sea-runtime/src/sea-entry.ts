import { DISPATCHER_CONFIG, dispatch } from 'service-registry';
import { SERVICES } from './services.js';

// SEA entry: the dispatcher (libs/service-registry) picks the role. No --service starts the supervisor, --service <id> starts that one service, --generate-certs creates the TLS files next to the executable and exits, anything else exits with the reject code.
// tools/scripts/compile-sea.ts bundles this file and aliases the specifiers below to the built bootstraps (typed in sea-modules.d.ts).
const target = dispatch(
  process.argv.slice(2),
  SERVICES.map((route) => route.id),
);
if (target.kind === 'rejected') {
  console.error(target.message);
  process.exit(DISPATCHER_CONFIG.rejectExitCode);
} else if (target.kind === 'service') {
  await import(`sea-services/${target.id}.js`);
} else if (target.kind === 'generate-certs') {
  const { runGenerateCerts } = await import('sea-certs-command');
  process.exitCode = runGenerateCerts();
} else {
  await import('sea-supervisor');
}
