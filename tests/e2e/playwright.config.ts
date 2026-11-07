import { defineConfig, devices } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import evidenceRoots from './evidence-root.cjs';
const graphicsPort = process.env.GRAPHICS_E2E_PORT;
const engine = process.env.E2E_BROWSER ?? 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(engine)) throw new Error('E2E_BROWSER must be chromium, firefox or webkit');
if (graphicsPort && (!/^\d+$/.test(graphicsPort) || Number(graphicsPort) < 1024 || Number(graphicsPort) > 65535 || ['4300', '4301', '4302'].includes(graphicsPort))) throw new Error('GRAPHICS_E2E_PORT must be an isolated port between 1024 and 65535');
const devServers = process.env.E2E_DEV_SERVERS === '1';
if (devServers && (process.env.E2E_BASE_URL || graphicsPort)) throw new Error('Choose E2E_DEV_SERVERS, external Compose or the isolated graphics server');
const external = process.env.E2E_BASE_URL || (!graphicsPort && !devServers ? `http://127.0.0.1:${process.env.TOROBTICKET_PORT ?? '4300'}` : undefined);
if (external) {
  const url = new URL(external);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !url.port || Number(url.port) < 1024 || Number(url.port) > 65535) throw new Error('E2E_BASE_URL must be an explicit loopback HTTP origin with a nonprivileged port');
  if (graphicsPort) throw new Error('Choose external Compose or the isolated graphics dev server, not both');
}
const webUrl = external ? new URL(external).origin : `http://127.0.0.1:${graphicsPort ?? '4300'}`;
const workspace = resolve(typeof __dirname === 'string' ? __dirname : 'tests/e2e', '../..');
const evidence = external ? evidenceRoots.evidenceRootPath(process.env.E2E_EVIDENCE_DIR ?? '.local/evidence/T30/acceptance-current', workspace) : undefined;
if (evidence) {
  // Discover literal feature evidence variables before test modules load, so a
  // new regression cannot overwrite an earlier task's captures during this run.
  const keys = new Set(['T30_EVIDENCE_DIR']);
  const collect = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = resolve(folder, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (/\.[cm]?tsx?$/.test(entry.name)) for (const match of readFileSync(path, 'utf8').matchAll(/\bprocess\.env\.([A-Z][A-Z0-9_]*EVIDENCE_DIR)\b/g)) keys.add(match[1]!);
    }
  };
  // Playwright loads this TypeScript config as CommonJS in this workspace;
  // direct Node probes also support the repository-root ESM import path.
  collect(resolve(typeof __dirname === 'string' ? __dirname : 'tests/e2e', 'src'));
  keys.delete('E2E_EVIDENCE_DIR');
  for (const key of keys) {
    process.env[key] = resolve(evidence, key.toLowerCase());
    mkdirSync(process.env[key], { recursive: true });
  }
  process.env.E2E_BASE_URL = webUrl;
  process.env.E2E_EVIDENCE_DIR = evidence;
  const admin = new URL(webUrl); admin.port = process.env.TOROBTICKET_ADMIN_PORT || '4301';
  const configuredAdmin = new URL(process.env.TOROBTICKET_ADMIN_ORIGIN || admin.origin);
  if (configuredAdmin.hostname !== new URL(webUrl).hostname || configuredAdmin.protocol !== 'http:' || !configuredAdmin.port || Number(configuredAdmin.port) < 1024 || Number(configuredAdmin.port) > 65535 || configuredAdmin.origin === webUrl || configuredAdmin.username || configuredAdmin.password || configuredAdmin.pathname !== '/' || configuredAdmin.search || configuredAdmin.hash) throw new Error('Admin E2E origin must use the web hostname and scheme with a distinct loopback port');
  process.env.ADMIN_E2E_URL = configuredAdmin.origin;
}
export default defineConfig({
  testDir: './src',
  fullyParallel: !external,
  workers: external ? 1 : undefined,
  timeout: 60000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: external ? [['./safe-reporter.mjs']] : [['list']],
  metadata: evidence ? { evidenceRoot: evidence, workspaceRoot: workspace } : {},
  outputDir: evidence ? resolve(evidence, 'artifacts') : undefined,
  use: { baseURL: webUrl, trace: external ? 'off' : 'retain-on-failure', actionTimeout: 10000, navigationTimeout: 30000 },
  // Choose one engine per run; callers supply a distinct evidence root per engine.
  projects: [{ name: engine, use: { ...devices[engine === 'chromium' ? 'Desktop Chrome' : engine === 'firefox' ? 'Desktop Firefox' : 'Desktop Safari'], ...(engine === 'chromium' ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) } }],
  webServer: external ? undefined : graphicsPort ? [{ command: `pnpm exec vite --config apps/web/vite.config.mts --port=${graphicsPort}`, url: webUrl, reuseExistingServer: false, cwd: '../..' }] : [
    { command: 'pnpm nx serve web', url: 'http://127.0.0.1:4300', reuseExistingServer: false, cwd: '../..' },
    { command: 'pnpm nx serve admin', url: 'http://127.0.0.1:4301/admin/', reuseExistingServer: false, cwd: '../..' },
    { command: 'pnpm nx serve api', url: 'http://127.0.0.1:4302/api/health/live', reuseExistingServer: false, cwd: '../..' }
  ]
});
