import { configuredOrigin } from './issuer-origin';
export function exampleProviderOrigin() {
  const platform = new URL(configuredOrigin());
  const port = process.env.TOROBTICKET_EXAMPLE_PROVIDER_PORT || '4310';
  const fallback = platform.hostname === 'localhost' ? `http://127.0.0.1:${port}` : `http://localhost:${port}`;
  const site = new URL(process.env.TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN || fallback);
  if (site.username || site.password || site.pathname !== '/' || site.search || site.hash || (site.protocol !== 'https:' && !(site.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(site.hostname)))) throw new Error('Example provider requires an HTTPS or loopback origin');
  if (site.hostname === platform.hostname) throw new Error('Example provider must use a different hostname from TorobTicket');
  return site.origin;
}
export function exampleProviderInternalOrigin() { return process.env.TOROBTICKET_EXAMPLE_PROVIDER_INTERNAL_ORIGIN || exampleProviderOrigin(); }
