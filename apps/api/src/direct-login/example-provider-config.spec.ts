import { afterEach, describe, expect, it, vi } from 'vitest';
import { exampleProviderOrigin } from './example-provider-config';
afterEach(() => vi.unstubAllEnvs());
describe('separate provider origin', () => {
  it('uses a different hostname and the configured published port', () => {
    vi.stubEnv('TOROBTICKET_SSO_ORIGIN', 'http://127.0.0.1:4300'); vi.stubEnv('TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN', ''); vi.stubEnv('TOROBTICKET_EXAMPLE_PROVIDER_PORT', '4410');
    expect(exampleProviderOrigin()).toBe('http://localhost:4410');
    vi.stubEnv('TOROBTICKET_SSO_ORIGIN', 'http://localhost:4300'); expect(exampleProviderOrigin()).toBe('http://127.0.0.1:4410');
  });
  it('rejects same-host ports, insecure nonloopback origins and URL credentials', () => {
    vi.stubEnv('TOROBTICKET_SSO_ORIGIN', 'http://127.0.0.1:4300');
    for (const value of ['http://127.0.0.1:4310', 'http://seller.example', 'https://user:password@seller.example', 'https://seller.example/path']) { vi.stubEnv('TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN', value); expect(exampleProviderOrigin).toThrow(); }
    vi.stubEnv('TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN', 'https://seller.example'); expect(exampleProviderOrigin()).toBe('https://seller.example');
  });
});
