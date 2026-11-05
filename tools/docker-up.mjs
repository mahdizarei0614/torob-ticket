import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { knownLegacyGatewayIds } from './docker-dev-services.mjs';
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
  const binding = (service, target) => config.services[service]?.ports?.find(port => port.target === target && port.host_ip === '127.0.0.1')?.published;
  const port = binding('web', 4300), adminPort = binding('admin', 4301), providerPort = binding('example-provider', 4310);
  if (!port || !adminPort || !providerPort || new Set([port, adminPort, providerPort]).size !== 3) throw new Error('Web, admin and provider require distinct loopback-only published ports.');
  if (development) await prepareDevelopmentMountpoint(cwd);
  // Build before retiring the old gateway so a failed build preserves serving.
  await compose(['build']);
  const containers = await compose(['ps', '--all', '--format', 'json'], true);
  for (const id of knownLegacyGatewayIds(containers, config.name)) await docker(['rm', '--force', id]);
  await compose(['up', '--wait', '--wait-timeout', '120']);
  for (const [service, published, path] of [['web', port, '/'], ['admin', adminPort, '/admin/']]) {
    const ready = await fetch(`http://127.0.0.1:${published}/api/health/ready`, { signal: AbortSignal.timeout(5000) });
    if (!ready.ok || (await ready.json()).status !== 'ready') throw new Error(`${service} API readiness failed: HTTP ${ready.status}`);
    const frontend = await fetch(`http://127.0.0.1:${published}${path}`, { signal: AbortSignal.timeout(5000) });
    const html = await frontend.text();
    if (!frontend.ok || !html.includes('<html') || (development && !html.includes('@vite/client'))) throw new Error(`${development ? 'Development' : 'Packaged'} frontend unavailable: ${service}`);
  }
  const providerReady = await fetch(`http://127.0.0.1:${providerPort}/health/ready`, { signal: AbortSignal.timeout(5000) });
  if (!providerReady.ok) throw new Error(`Provider readiness failed: HTTP ${providerReady.status}`);
  if (development) console.log('Hot reload: source edits update web/admin automatically; successful API/provider TypeScript compilations restart their server.');
  const issuer = new URL(config.services.api.environment.TOROBTICKET_SSO_ORIGIN);
  const provider = config.services['example-provider'];
  const providerOrigin = provider.environment.TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN || `http://${issuer.hostname === 'localhost' ? '127.0.0.1' : 'localhost'}:${provider.environment.TOROBTICKET_EXAMPLE_PROVIDER_PORT}`;
  const adminOrigin = new URL(config.services.api.environment.TOROBTICKET_ADMIN_ORIGIN || issuer.origin); if (!config.services.api.environment.TOROBTICKET_ADMIN_ORIGIN) adminOrigin.port = String(adminPort);
  console.log(`Web: ${issuer.origin}/\nAdmin: ${adminOrigin.origin}/admin/\nProvider: ${providerOrigin}/`);
} catch (error) {
  const command = development ? 'pnpm docker:dev' : 'pnpm docker:up';
  const inspection = `docker compose ${composeFiles.length ? composeFiles.join(' ') + ' ' : ''}`;
  console.error(`Startup failed: ${error.message}\nInspect: ${inspection}ps --all\nLogs: ${inspection}logs --tail 80\nFix the reported failure and rerun ${command}. Data is preserved; docker:reset explicitly deletes this project's volume.`);
  await compose(['ps', '--all']).catch(() => {});
  await compose(['logs', '--no-color', '--tail', '80']).catch(() => {});
  process.exitCode = 1;
}
