import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './src',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4300', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'pnpm nx serve web', url: 'http://127.0.0.1:4300', reuseExistingServer: false, cwd: '../..' },
    { command: 'pnpm nx serve admin', url: 'http://127.0.0.1:4301/admin/', reuseExistingServer: false, cwd: '../..' },
    { command: 'pnpm nx serve api', url: 'http://127.0.0.1:4302/api/health/live', reuseExistingServer: false, cwd: '../..' }
  ]
});
