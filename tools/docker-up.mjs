import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
function compose(args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', ...args], { cwd, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    let output = '';
    if (capture) child.stdout.on('data', chunk => output += chunk);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`docker compose ${args.join(' ')} exited ${code}`)));
  });
}
try {
  // Compose resolves .env and shell overrides once; print the actual published port.
  const config = JSON.parse(await compose(['config', '--format', 'json'], true));
  const port = config.services.gateway.ports.find(port => port.target === 80 && port.host_ip === '127.0.0.1')?.published;
  if (!port) throw new Error('Gateway requires a loopback-only published port. Check compose.yaml and TOROBTICKET_PORT.');
  await compose(['up', '--build', '--wait', '--wait-timeout', '120']);
  const response = await fetch(`http://127.0.0.1:${port}/api/health/ready`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok || (await response.json()).status !== 'ready') throw new Error(`Gateway readiness failed: HTTP ${response.status}`);
  console.log(`Web: http://localhost:${port}/\nAdmin: http://localhost:${port}/admin/`);
} catch (error) {
  console.error(`Startup failed: ${error.message}\nInspect: docker compose ps --all\nLogs: docker compose logs --tail 80\nFix the reported failure and rerun pnpm docker:up. Data is preserved; docker:reset explicitly deletes this project's volume.`);
  await compose(['ps', '--all']).catch(() => {});
  await compose(['logs', '--no-color', '--tail', '80']).catch(() => {});
  process.exitCode = 1;
}
