import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfig from '../../tsconfig.base.json' with { type: 'json' };
export default defineConfig({ root: 'apps/admin', publicDir: '../../assets', base: '/admin/', plugins: [react()], resolve: { alias: Object.fromEntries(Object.entries(tsconfig.compilerOptions.paths).map(([name, paths]) => [name, decodeURIComponent(new URL('../../' + paths[0], import.meta.url).pathname)])) }, server: { host: '127.0.0.1', port: 4301, strictPort: true, proxy: { '/api': 'http://127.0.0.1:4302' } }, build: { outDir: '../../dist/apps/admin', emptyOutDir: true } });
