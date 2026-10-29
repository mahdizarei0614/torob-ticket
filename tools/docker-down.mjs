import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { knownDevelopmentFrontendIds } from './docker-dev-services.mjs';

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
  for (const id of knownDevelopmentFrontendIds(containers, config.name)) docker(['rm', '--force', id]);
  docker(['compose', 'down']);
} catch (error) {
  console.error(`Shutdown failed: ${error.message}`);
  process.exitCode = 1;
}
