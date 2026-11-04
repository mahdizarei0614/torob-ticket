import { defineConfig } from 'vitest/config';
import integration from './apps/api/vitest.integration.config.ts';
import react from '@vitejs/plugin-react';
import tsconfig from './tsconfig.base.json' with { type: 'json' };
export default defineConfig({ plugins: [react()], resolve: { alias: Object.fromEntries(Object.entries(tsconfig.compilerOptions.paths).map(([name, paths]) => [name, decodeURIComponent(new URL('./' + paths[0], import.meta.url).pathname)])) }, test: { projects: [
  { extends: true, test: { name: 'web', environment: 'jsdom', include: ['apps/web/src/**/*.spec.{ts,tsx}'], setupFiles: ['./tools/test-setup.ts'] } },
  { extends: true, test: { name: 'admin', environment: 'jsdom', include: ['apps/admin/src/**/*.spec.tsx'], setupFiles: ['./tools/test-setup.ts'] } },
  { extends: true, test: { name: 'api', environment: 'node', include: ['apps/api/src/**/*.spec.ts'], exclude: ['**/*.integration.spec.ts'], testTimeout: 10000 } },
  { extends: true, test: { name: 'example-provider', environment: 'node', include: ['apps/example-provider/src/**/*.spec.ts'], testTimeout: 10000 } },
  integration,
  { extends: true, test: { name: 'server-libs', environment: 'node', include: ['libs/{fixtures,provider-adapters,data-access,provider-sdk}/src/**/*.spec.ts'] } },
  { extends: true, test: { name: 'pure', environment: 'node', include: ['libs/{domain,contracts,client}/src/**/*.spec.ts'] } },
  { extends: true, test: { name: 'ui', environment: 'jsdom', include: ['libs/{ui,graphics}/src/**/*.spec.{ts,tsx}'], setupFiles: ['./tools/test-setup.ts'] } }
] } });
