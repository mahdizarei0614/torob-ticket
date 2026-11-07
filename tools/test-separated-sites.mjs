import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separatedSites } from './vite-separated-sites.mts';

function route(surface, request, options = {}) {
  const keys = ['TOROBTICKET_SSO_ORIGIN', 'TOROBTICKET_ADMIN_ORIGIN', 'TOROBTICKET_ADMIN_PORT', 'TOROBTICKET_PORT', 'GRAPHICS_E2E_PORT'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, options.env);
    let middleware;
    separatedSites(surface).configureServer({
      config: { server: { port: options.port ?? (surface === 'web' ? 4300 : 4301) } },
      middlewares: { use(handler) { middleware = handler; } }
    });
    const result = { next: false, ended: false };
    middleware({ method: 'GET', url: '/', headers: { host: '127.0.0.1:4300' }, ...request }, {
      writeHead(status, headers) { Object.assign(result, { status, headers }); },
      end() { result.ended = true; }
    }, () => { result.next = true; });
    return result;
  } finally {
    for (const key of keys) if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
  }
}

test('alternate frontend entry redirects before bootstrap, preserving the complete query', () => {
  const uri = '/?q=%7B%22scope%22%3A%22international%22%7D&next=https%3A%2F%2Fevil.invalid';
  const response = route('web', { url: uri });
  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, 'http://localhost:4300' + uri);
  assert.equal(response.next, false);
  assert.equal(response.ended, true);
  assert.equal(route('admin', { url: '/admin/direct-login?tab=partners', headers: { host: '127.0.0.1:4301' } }).headers.Location,
    'http://localhost:4301/admin/direct-login?tab=partners');
});

test('canonical navigation does not redirect and forwarded host cannot select a destination', () => {
  assert.equal(route('web', { headers: { host: 'localhost:4300' } }).next, true);
  assert.equal(route('admin', { url: '/admin/', headers: { host: 'localhost:4301' } }).next, true);
  const response = route('web', { headers: { host: 'evil.invalid', 'x-forwarded-host': 'evil.invalid', 'x-forwarded-proto': 'https' } });
  assert.equal(response.headers.Location, 'http://localhost:4300/');
  assert.equal(route('web', { headers: { host: 'LOCALHOST:4300' } }).next, true);
});

test('canonical origin supports reverse loopback configuration, custom published ports and IPv6', () => {
  for (const origin of ['http://127.0.0.1:4400', 'http://[::1]:4400']) {
    const env = { TOROBTICKET_SSO_ORIGIN: origin, TOROBTICKET_ADMIN_PORT: '4401' };
    const admin = new URL(origin); admin.port = '4401';
    assert.equal(route('web', {}, { env }).headers.Location, origin + '/');
    assert.equal(route('admin', { url: '/admin/' }, { env }).headers.Location, admin.origin + '/admin/');
    assert.equal(route('web', { headers: { host: new URL(origin).host } }, { env }).next, true);
  }
});

test('API calls and mutations are never redirected or replayed to another origin', () => {
  for (const surface of ['web', 'admin']) {
    for (const url of ['/api', '/api/health/ready', '/api/v1/direct-login/authorizations']) {
      for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS']) {
        assert.equal(route(surface, { url, method }).next, true, `${surface} ${method} ${url}`);
      }
    }
    assert.equal(route(surface, { url: '/', method: 'POST' }).next, true);
  }
  assert.equal(route('web', { method: 'HEAD' }).status, 302);
});

test('standalone graphics port stays isolated while ordinary cross-app links use configured origins', () => {
  assert.equal(route('web', { headers: { host: '127.0.0.1:4317' } }, { port: 4317 }).next, true);
  assert.equal(route('web', { headers: { host: '127.0.0.1:4317' } }, { port: 4317, env: { GRAPHICS_E2E_PORT: '4317', TOROBTICKET_SSO_ORIGIN: 'http://localhost:4300' } }).next, true);
  assert.equal(route('web', { url: '/admin/direct-login?tab=partners' }).headers.Location,
    'http://localhost:4301/admin/direct-login?tab=partners');
  assert.equal(route('admin', { url: '/direct-login/begin?ref=opaque' }).headers.Location,
    'http://localhost:4300/direct-login/begin?ref=opaque');
});
