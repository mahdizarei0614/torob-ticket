export function configuredOrigin() {
  const url = new URL(process.env.TOROBTICKET_SSO_ORIGIN ?? 'http://localhost:4300');
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('TOROBTICKET_SSO_ORIGIN must be an HTTPS origin or loopback HTTP origin');
  return url.origin;
}
export function configuredAdminOrigin() {
  const web = new URL(configuredOrigin());
  const fallback = new URL(web); fallback.port = process.env.TOROBTICKET_ADMIN_PORT || '4301';
  const admin = new URL(process.env.TOROBTICKET_ADMIN_ORIGIN || fallback.origin);
  if (admin.username || admin.password || admin.pathname !== '/' || admin.search || admin.hash || admin.hostname !== web.hostname || admin.protocol !== web.protocol || admin.origin === web.origin) throw new Error('Admin origin must share the canonical web hostname and scheme');
  return admin.origin;
}
