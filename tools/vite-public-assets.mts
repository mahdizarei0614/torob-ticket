import type { Plugin } from 'vite';

/** Keep public head URLs and unserved asset responses authoritative in Vite. */
export function publicAssetFallback(): Plugin {
  return {
    name: 'public-asset-fallback',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Env interpolation already supplies base; the normal asset pass would
        // prefix these static public links again. Keep CSS/modules on that pass.
        return html.replace(/<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, tag => {
          const rel = tag.match(/\srel\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim().toLowerCase();
          const href = tag.match(/\shref\s*=\s*(["'])(.*?)\1/i)?.[2];
          if (!rel || !['icon', 'apple-touch-icon', 'mask-icon', 'manifest'].includes(rel) || !href?.startsWith('%BASE_URL%') || /\svite-ignore(?:\s|=|>)/i.test(tag)) return tag;
          return tag.replace(/^<link\b/i, '<link vite-ignore');
        });
      },
    },
    configureServer(server) {
      const base = server.config.base;
      return () => {
        server.middlewares.use((request, response, next) => {
          if (request.method !== 'GET' && request.method !== 'HEAD') return next();
          let pathname: string;
          try { pathname = decodeURIComponent(new URL(request.originalUrl ?? request.url ?? '/', 'http://localhost').pathname); }
          catch { return next(); }
          if (!pathname.startsWith(base)) return next();
          const asset = '/' + pathname.slice(base.length);
          const namespace = /^\/(?:assets|brand|airlines|ground-operators|fonts|maps|geography|licenses)(?:\/|$)/.test(asset);
          const icon = /^\/(?:favicon[^/]*|apple-touch-icon(?:-[^/]*)?\.png|safari-pinned-tab\.svg|(?:site|admin)\.webmanifest)$/.test(asset);
          if (!namespace && !icon) return next();
          response.statusCode = 404;
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(request.method === 'HEAD' ? undefined : 'Not found');
        });
      };
    },
  };
}
