export function configuredOrigin() {
  const url = new URL(process.env.TOROBTICKET_SSO_ORIGIN ?? 'http://localhost:4300');
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('TOROBTICKET_SSO_ORIGIN must be an HTTPS origin or loopback HTTP origin');
  return url.origin;
}
