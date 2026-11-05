import { separatedSites } from '../../tools/vite-separated-sites.mts';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { publicAssetFallback } from '../../tools/vite-public-assets.mts';
import { brandMetadata } from '../../tools/vite-brand-metadata.mts';
import tsconfig from '../../tsconfig.base.json' with { type: 'json' };
const workspaceLibraryWatch: Plugin = {
  name: 'workspace-library-watch',
  apply: 'serve',
  configureServer(server) {
    server.watcher.add(decodeURIComponent(new URL('../../libs', import.meta.url).pathname));
  },
};
export default defineConfig({ root: 'apps/admin', publicDir: '../../assets', base: '/admin/', cacheDir: '../../.dev/vite-admin', plugins: [separatedSites('admin'), react(), publicAssetFallback(), workspaceLibraryWatch, brandMetadata(true)], resolve: { alias: Object.fromEntries(Object.entries(tsconfig.compilerOptions.paths).map(([name, paths]) => [name, decodeURIComponent(new URL('../../' + paths[0], import.meta.url).pathname)])) }, server: { host: process.env.TOROBTICKET_DEV_HOST ?? '127.0.0.1', port: 4301, strictPort: true, ...(process.env.TOROBTICKET_DEV_PORT && { ws: { clientPort: Number(process.env.TOROBTICKET_DEV_PORT), path: '__hmr' } }), ...(process.env.TOROBTICKET_DEV_POLLING === 'true' && { watch: { usePolling: true, interval: 250 } }), proxy: { '/api': process.env.TOROBTICKET_ADMIN_API_PROXY ?? 'http://127.0.0.1:4302' } }, build: { outDir: '../../dist/apps/admin', emptyOutDir: true } });
