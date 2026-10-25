import { defineConfig, devices } from '@playwright/test';
const graphicsPort = process.env.GRAPHICS_E2E_PORT;
if (graphicsPort && (!/^\d+$/.test(graphicsPort) || Number(graphicsPort) < 1024 || Number(graphicsPort) > 65535 || ['4300', '4301', '4302'].includes(graphicsPort))) throw new Error('GRAPHICS_E2E_PORT must be an isolated port between 1024 and 65535');
const webUrl = `http://127.0.0.1:${graphicsPort ?? '4300'}`;
export default defineConfig({
  testDir: './src',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: { baseURL: webUrl, trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: graphicsPort ? [{ command: `pnpm exec vite --config apps/web/vite.config.mts --port=${graphicsPort}`, url: webUrl, reuseExistingServer: false, cwd: '../..' }] : [
    { command: 'pnpm nx serve web', url: 'http://127.0.0.1:4300', reuseExistingServer: false, cwd: '../..' },
    { command: 'pnpm nx serve admin', url: 'http://127.0.0.1:4301/admin/', reuseExistingServer: false, cwd: '../..' },
    { command: 'pnpm nx serve api', url: 'http://127.0.0.1:4302/api/health/live', reuseExistingServer: false, cwd: '../..' }
  ]
});
