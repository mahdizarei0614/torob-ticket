import { afterEach, describe, expect, it, vi } from 'vitest';
import { DirectLoginService } from './direct-login.service';
import { configuredAdminOrigin } from './issuer-origin';
import type { SessionService } from '../sessions/session.service';
import { unavailableVerifier } from './enrollment-verifier';
afterEach(() => vi.unstubAllEnvs());
describe('separate first-party origins', () => {
  it('derives admin from canonical hostname and a distinct configured port', () => {
    vi.stubEnv('TOROBTICKET_SSO_ORIGIN', 'http://127.0.0.1:4400'); vi.stubEnv('TOROBTICKET_ADMIN_ORIGIN', ''); vi.stubEnv('TOROBTICKET_ADMIN_PORT', '4401');
    expect(configuredAdminOrigin()).toBe('http://127.0.0.1:4401');
    vi.stubEnv('TOROBTICKET_SSO_ORIGIN', 'http://[::1]:4400'); expect(configuredAdminOrigin()).toBe('http://[::1]:4401');
    vi.stubEnv('TOROBTICKET_ADMIN_ORIGIN', 'http://localhost:4401'); expect(configuredAdminOrigin).toThrow();
  });
  it('permits admin writes from its exact origin while phone/consent stay web-only', () => {
    vi.stubEnv('TOROBTICKET_SSO_ORIGIN', 'http://127.0.0.1:4300'); vi.stubEnv('TOROBTICKET_ADMIN_ORIGIN', ''); vi.stubEnv('TOROBTICKET_ADMIN_PORT', '4301');
    const service = new DirectLoginService({} as SessionService, unavailableVerifier);
    const request = { headers: { origin: 'http://127.0.0.1:4301', 'sec-fetch-site': 'same-origin' } };
    expect(() => service.assertBrowserMutation(request, 'admin')).not.toThrow();
    expect(() => service.assertBrowserMutation(request)).toThrow();
    expect(() => service.assertBrowserMutation({ headers: { ...request.headers, origin: 'http://127.0.0.1:4303' } }, 'admin')).toThrow();
    expect(() => service.assertBrowserMutation({ headers: { ...request.headers, 'sec-fetch-site': 'cross-site' } }, 'admin')).toThrow();
  });
});
