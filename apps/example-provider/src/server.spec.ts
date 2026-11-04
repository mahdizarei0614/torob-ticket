import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createProviderSite, type SiteConfiguration } from './server';
import { randomToken } from '@torob-ticket/provider-sdk';
const clientId = '66666666-4444-4444-8888-444444444444', issuerOrigin = 'http://127.0.0.1:4399', secret = randomToken();
let origin = 'http://localhost:4310';
const registration = { revision: 1, clientId, clientSecret: secret, issuer: `${issuerOrigin}/api/v1/direct-login/issuer/${clientId}`, callbackUrl: origin + '/callback', providerId: 'provider-1', providerName: 'راه‌آرا', providerOrigin: origin };
describe('independent provider HTTP backend', () => {
  let site: ReturnType<typeof createProviderSite>, folder: string, base: string, nonce = '', tokenCalls = 0, status = true, reportFails = true, issuedRevision = 1;
  const cookies = new Map<string, string>();
  const keys = generateKeyPairSync('ed25519');
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'external-provider-')); cookies.clear(); tokenCalls = 0; status = true; reportFails = true; issuedRevision = 1;
    const transport: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin).toBe('http://issuer.internal:4302');
      if (url.pathname.endsWith('/example-registration')) return json({ ...registration, revision: issuedRevision });
      if (url.pathname.endsWith('/client-status')) return json({ active: status }, status ? 200 : 401);
      if (url.pathname.endsWith('/acknowledgments')) return json({ accepted: true });
      if (url.pathname.endsWith('/account-events')) return json({ accepted: true }, reportFails ? 503 : 200);
      if (url.pathname.endsWith('/jwks')) return json({ keys: [{ ...keys.publicKey.export({ format: 'jwk' }), kid: 'key-1' }] });
      if (url.pathname.endsWith('/token')) {
        tokenCalls++;
        expect(new URLSearchParams(String(init?.body)).get('client_secret')).toBe(secret);
        const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'key-1' })).toString('base64url'), now = Math.floor(Date.now() / 1000);
        const body = Buffer.from(JSON.stringify({ iss: registration.issuer, aud: clientId, sub: 'subject-1', exp: now + 120, iat: now, nonce, phone_number: '+989000000001', phone_number_verified: true, referral_id: 'referral-1', attribution: 'pending', traveler_profile: { givenName: '</pre><script>alert(1)</script>', familyName: 'ایرانی', birthDate: '1992-03-04', gender: 'female', nationality: 'IR', nationalId: '0012345678' } })).toString('base64url');
        return json({ id_token: `${header}.${body}.${sign(null, Buffer.from(`${header}.${body}`), keys.privateKey).toString('base64url')}` });
      }
      throw new Error('Unexpected endpoint');
    };
    const probe = createServer(); await new Promise<void>(r => probe.listen(0, '127.0.0.1', r)); const address = probe.address(); if (!address || typeof address === 'string') throw new Error('Expected TCP server'); const port = address.port; await new Promise<void>(r => probe.close(() => r()));
    origin = `http://localhost:${port}`; registration.providerOrigin = origin; registration.callbackUrl = origin + '/callback';
    const config: SiteConfiguration = { origin, issuerOrigin, issuerInternalOrigin: 'http://issuer.internal:4302', storeFile: join(folder, 'store.json'), publicDirectory: resolve('apps/example-provider/public'), assetsDirectory: resolve('assets'), transport };
    site = createProviderSite(config); await new Promise<void>(r => site.server.listen(port, '127.0.0.1', r));
    base = origin;
    expect((await call('/internal/registrations', { clientId, code: randomToken() })).status).toBe(200);
  });
  afterEach(async () => { await new Promise<void>((r, reject) => site.server.close(e => e ? reject(e) : r())); await rm(folder, { recursive: true, force: true }); });
  async function call(path: string, body?: unknown, supplied = cookies) {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { host: new URL(origin).host, cookie: [...supplied].map(([k, v]) => `${k}=${v}`).join('; '), ...(body ? { 'content-type': 'application/json' } : {}) }, redirect: 'manual', ...(body ? { body: JSON.stringify(body) } : {}) });
    for (const cookie of response.headers.getSetCookie()) { const [key, value] = cookie.split(';')[0]!.split('='); supplied.set(key!, value!); }
    return response;
  }
  async function login() {
    const response = await call(`/providers/${clientId}/login?ref=${randomToken()}`); expect(response.status).toBe(303);
    expect(response.headers.getSetCookie()[0]).toContain('HttpOnly; SameSite=Lax'); expect(response.headers.getSetCookie()[0]).not.toContain('Domain=');
    const start = new URL(response.headers.get('location')!); nonce = start.searchParams.get('nonce')!; expect(start.searchParams.get('scope')).toBe('openid phone traveler');
    return `/callback?state=${start.searchParams.get('state')!}&code=${randomToken()}`;
  }
  it('exchanges the SDK callback, escapes approved JSON, creates once and reuses the subject account', async () => {
    const callback = await login(); expect((await call(callback)).status).toBe(303);
    let html = await (await call(`/providers/${clientId}`)).text(); expect(html).toContain('id="sso-response"'); expect(html).toContain('&lt;/pre&gt;&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).not.toContain(secret); expect(html).not.toContain('id_token'); expect(html).toContain('&quot;status&quot;: &quot;created&quot;');
    await call(callback); expect(tokenCalls).toBe(1);
    const second = await login(); await call(second); html = await (await call(`/providers/${clientId}`)).text(); expect(html).toContain('&quot;status&quot;: &quot;existing&quot;');
    const state = JSON.parse(await readFile(join(folder, 'store.json'), 'utf8')); expect(state.accounts).toHaveLength(1); expect(state.outbox[0].delivered).toBe(false);
    reportFails = false; await site.retryReports(); expect(JSON.parse(await readFile(join(folder, 'store.json'), 'utf8')).outbox[0].delivered).toBe(true);
    expect((await stat(join(folder, 'store.json'))).mode & 0o777).toBe(0o600);
  });
  it('requires the browser transaction and matching state and denies anonymous JSON access', async () => {
    const callback = await login();
    expect((await call(callback, undefined, new Map())).status).toBe(400);
    expect((await call(callback.replace(/state=[^&]+/, `state=${randomToken()}`))).status).toBe(400); expect(tokenCalls).toBe(0);
    await call(callback); expect((await (await call(`/providers/${clientId}`, undefined, new Map())).text())).not.toContain('id="sso-response"');
    status = false; const unavailable = await call(`/providers/${clientId}`); expect(unavailable.status).toBe(400); expect(await unavailable.text()).not.toContain('nationalId');
  });
  it('handles denial without exchanging a code and excludes issuer cookies and credentials from the landing', async () => {
    const callback = new URL(await login(), origin); callback.searchParams.delete('code'); callback.searchParams.set('error', 'access_denied');
    const response = await call(callback.pathname + callback.search); expect(response.headers.get('location')).toContain('cancelled=1'); expect(tokenCalls).toBe(0);
    expect([...cookies.keys()]).toEqual(['ep_flow']);
    const page = await (await call(response.headers.get('location')!)).text(); expect(page).not.toContain('id="sso-response"'); expect(page).not.toContain(secret); expect(page).toContain('اجازه دسترسی داده نشد');
  });
  it('rejects a stale installation without replacing newer credentials or clearing its sessions', async () => {
    issuedRevision = 3; expect((await call('/internal/registrations', { clientId, code: randomToken() })).status).toBe(200);
    await call(await login());
    issuedRevision = 2; expect((await call('/internal/registrations', { clientId, code: randomToken() })).status).toBe(400);
    const data = JSON.parse(await readFile(join(folder, 'store.json'), 'utf8')); expect(data.registrations[0].revision).toBe(3); expect(data.sessions).toHaveLength(1);
  });

  it('binds logout to its session even when no-referrer makes the form Origin null', async () => {
    const callback = await login(); await call(callback);
    const html = await (await call(`/providers/${clientId}`)).text(), csrf = /name="csrf" value="([a-f0-9]{64})"/.exec(html)![1]!;
    const submit = (body: string, originHeader = 'null', siteHeader = 'same-origin') => fetch(base + `/providers/${clientId}/logout`, { method: 'POST', redirect: 'manual', headers: { origin: originHeader, 'sec-fetch-site': siteHeader, 'content-type': 'application/x-www-form-urlencoded', cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') }, body });
    expect((await submit('')).status).toBe(400); expect((await submit('csrf=wrong')).status).toBe(400); expect((await submit(`csrf=${csrf}&csrf=${csrf}`)).status).toBe(400);
    expect((await submit(`csrf=${csrf}`, 'https://foreign.example')).status).toBe(400); expect((await submit(`csrf=${csrf}`, origin, 'cross-site')).status).toBe(400);
    expect((await submit(`csrf=${csrf}`)).status).toBe(303);
    expect((await call(callback)).headers.get('location')).toContain('interrupted=1');
    expect(await (await call(`/providers/${clientId}`)).text()).not.toContain('id="sso-response"');
  });

});
