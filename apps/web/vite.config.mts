import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfig from '../../tsconfig.base.json' with { type: 'json' };
const workspaceLibraryWatch: Plugin = {
  name: 'workspace-library-watch',
  apply: 'serve',
  configureServer(server) {
    server.watcher.add(decodeURIComponent(new URL('../../libs', import.meta.url).pathname));
  },
};
export default defineConfig({ root: 'apps/web', publicDir: '../../assets', base: '/', cacheDir: '../../.dev/vite-web', plugins: [react(), workspaceLibraryWatch], resolve: { alias: Object.fromEntries(Object.entries(tsconfig.compilerOptions.paths).map(([name, paths]) => [name, decodeURIComponent(new URL('../../' + paths[0], import.meta.url).pathname)])) }, server: { host: process.env.TOROBTICKET_DEV_HOST ?? '127.0.0.1', port: 4300, strictPort: true, ...(process.env.TOROBTICKET_DEV_PORT && { ws: { clientPort: Number(process.env.TOROBTICKET_DEV_PORT), path: '__hmr' } }), ...(process.env.TOROBTICKET_DEV_POLLING === 'true' && { watch: { usePolling: true, interval: 250 } }), proxy: { '/admin': process.env.TOROBTICKET_WEB_ADMIN_PROXY ?? process.env.TOROBTICKET_WEB_API_PROXY ?? 'http://127.0.0.1:4301', '/api': process.env.TOROBTICKET_WEB_API_PROXY ?? 'http://127.0.0.1:4302' } }, build: { outDir: '../../dist/apps/web', emptyOutDir: true } });
