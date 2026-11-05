import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { knownLegacyGatewayIds, knownDevelopmentVolumeNames } from './docker-dev-services.mjs';
console.log('Explicit reset: deleting the current Compose project containers and database volume.');
const cwd = fileURLToPath(new URL('../', import.meta.url));
function docker(args, capture = false) {
  const result = spawnSync('docker', args, { cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(capture ? result.stderr : `docker ${args.join(' ')} exited ${result.status}`);
  return result.stdout ?? '';
}
try {
  const config = JSON.parse(docker(['compose', 'config', '--format', 'json'], true));
  const containers = docker(['compose', 'ps', '--all', '--format', 'json'], true);
  for (const id of knownLegacyGatewayIds(containers, config.name)) docker(['rm', '--force', id]);
  docker(['compose', 'down', '--volumes']);
  const cache = docker(['volume', 'ls', '--filter', `label=com.docker.compose.project=${config.name}`, '--filter', 'label=com.docker.compose.volume=dev_prisma', '--filter', 'label=org.torobticket.role=generated-client', '--format', 'json'], true);
  for (const name of knownDevelopmentVolumeNames(cache, config.name)) docker(['volume', 'rm', name]);
} catch (error) {
  console.error(`Reset failed: ${error.message}`);
  process.exitCode = 1;
}
