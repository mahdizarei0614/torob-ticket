import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { knownDevelopmentFrontendIds } from './docker-dev-services.mjs';
import { prepareDevelopmentMountpoint } from './prepare-development.mjs';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const development = process.argv.includes('--dev');
const composeFiles = development ? ['-f', 'compose.yaml', '-f', 'compose.dev.yaml'] : [];
function docker(args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { cwd, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    let output = '';
    if (capture) child.stdout.on('data', chunk => output += chunk);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`docker ${args.join(' ')} exited ${code}`)));
  });
}
const compose = (args, capture = false) => docker(['compose', ...composeFiles, ...args], capture);
try {
  // Compose resolves .env and shell overrides once; print the actual published port.
  const config = JSON.parse(await compose(['config', '--format', 'json'], true));
  const port = config.services.gateway.ports.find(port => port.target === 80 && port.host_ip === '127.0.0.1')?.published;
  if (!port) throw new Error('Gateway requires a loopback-only published port. Check compose.yaml and TOROBTICKET_PORT.');
  if (development) await prepareDevelopmentMountpoint(cwd);
  await compose(['up', '--build', '--wait', '--wait-timeout', '120']);
  if (!development) {
    const containers = await compose(['ps', '--all', '--format', 'json'], true);
    for (const id of knownDevelopmentFrontendIds(containers, config.name)) await docker(['rm', '--force', id]);
  }
  const response = await fetch(`http://127.0.0.1:${port}/api/health/ready`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok || (await response.json()).status !== 'ready') throw new Error(`Gateway readiness failed: HTTP ${response.status}`);
  if (development) {
    for (const path of ['/', '/admin/']) {
      const frontend = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(5000) });
      if (!frontend.ok || !(await frontend.text()).includes('@vite/client')) throw new Error(`Development frontend unavailable: ${path}`);
    }
    console.log('Hot reload: source edits update web/admin automatically; successful API TypeScript compilations restart the server.');
  }
  console.log(`Web: http://localhost:${port}/\nAdmin: http://localhost:${port}/admin/`);
} catch (error) {
  const command = development ? 'pnpm docker:dev' : 'pnpm docker:up';
  const inspection = `docker compose ${composeFiles.length ? composeFiles.join(' ') + ' ' : ''}`;
  console.error(`Startup failed: ${error.message}\nInspect: ${inspection}ps --all\nLogs: ${inspection}logs --tail 80\nFix the reported failure and rerun ${command}. Data is preserved; docker:reset explicitly deletes this project's volume.`);
  await compose(['ps', '--all']).catch(() => {});
  await compose(['logs', '--no-color', '--tail', '80']).catch(() => {});
  process.exitCode = 1;
}
