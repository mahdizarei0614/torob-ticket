import { resolve } from 'node:path';
import { createProviderSite } from './server';
const issuerOrigin = new URL(process.env.TOROBTICKET_SSO_ORIGIN ?? 'http://localhost:4300').origin;
const port = process.env.TOROBTICKET_EXAMPLE_PROVIDER_PORT || '4310';
const fallback = new URL(issuerOrigin).hostname === 'localhost' ? `http://127.0.0.1:${port}` : `http://localhost:${port}`;
const origin = process.env.TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN || fallback;
const site = createProviderSite({ origin, issuerOrigin, issuerInternalOrigin: process.env.TOROBTICKET_ISSUER_INTERNAL_ORIGIN || issuerOrigin, storeFile: process.env.TOROBTICKET_PROVIDER_STORE || resolve('.local/example-provider/store.json'), publicDirectory: resolve('apps/example-provider/public'), assetsDirectory: resolve('assets') });
site.server.listen(Number(process.env.PORT || new URL(origin).port || 4310), process.env.HOST || '127.0.0.1', () => console.log(`Provider website ready at ${origin}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => site.server.close(() => process.exit(0)));
