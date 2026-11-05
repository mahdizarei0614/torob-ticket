import type { Plugin } from 'vite';
/** Each app serves only its own frontend; known navigation crosses origins. */
export function separatedSites(surface: 'web' | 'admin'): Plugin {
  const web = new URL(process.env.TOROBTICKET_SSO_ORIGIN || `http://localhost:${process.env.TOROBTICKET_PORT || 4300}`);
  const admin = new URL(web); admin.port = process.env.TOROBTICKET_ADMIN_PORT || '4301';
  const configuredAdmin = new URL(process.env.TOROBTICKET_ADMIN_ORIGIN || admin.origin);
  if (configuredAdmin.hostname !== web.hostname || configuredAdmin.protocol !== web.protocol || configuredAdmin.origin === web.origin || configuredAdmin.username || configuredAdmin.password || configuredAdmin.pathname !== '/' || configuredAdmin.search || configuredAdmin.hash) throw new Error('Admin must use the canonical web hostname and scheme with a separate port');
  const adminOrigin = configuredAdmin.origin;
  return { name: 'separated-sites', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const path = new URL(request.url || '/', web.origin).pathname;
      const destination = surface === 'web' && (path === '/admin' || path.startsWith('/admin/')) ? adminOrigin + request.url
        : surface === 'admin' && path === '/travel' ? web.origin + '/'
        : surface === 'admin' && ['/reference-provider/', '/provider-demo/', '/direct-login/'].some(prefix => path.startsWith(prefix)) ? web.origin + request.url : undefined;
      if (!destination) { next(); return; }
      response.writeHead(302, { Location: destination }); response.end();
    });
  } };
}
