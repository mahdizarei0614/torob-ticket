import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localReviewEnabled } from './local-review';
import { localSmsTestCode } from './sms-test-code';
beforeEach(() => {
  vi.stubEnv('NODE_ENV','production'); vi.stubEnv('TOROBTICKET_LOCAL_REVIEW','true'); vi.stubEnv('TOROBTICKET_SSO_TEST_SMS_CODE','123456');
  vi.stubEnv('TOROBTICKET_SSO_ORIGIN','http://localhost:4300'); vi.stubEnv('TOROBTICKET_ADMIN_ORIGIN',''); vi.stubEnv('TOROBTICKET_ADMIN_PORT','4301'); vi.stubEnv('TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN',''); vi.stubEnv('TOROBTICKET_EXAMPLE_PROVIDER_PORT','4310');
});
afterEach(() => vi.unstubAllEnvs());
describe('explicit local reviewer runtime', () => {
  it('supports packaged loopback verification and rechecks every opt-in', () => {
    expect(localReviewEnabled()).toBe(true); expect(localSmsTestCode('http://localhost:4300')).toBe('123456');
    vi.stubEnv('TOROBTICKET_LOCAL_REVIEW','false'); expect(localReviewEnabled()).toBe(false); expect(localSmsTestCode('http://localhost:4300')).toBeUndefined();
    vi.stubEnv('TOROBTICKET_LOCAL_REVIEW','true'); vi.stubEnv('TOROBTICKET_SSO_TEST_SMS_CODE','654321'); expect(localSmsTestCode('http://localhost:4300')).toBeUndefined();
  });
  it('rejects nonloopback, mismatched and invalid public origins', () => {
    expect(localReviewEnabled('http://127.0.0.1:4300')).toBe(false);
    for (const [setting,value] of [['TOROBTICKET_SSO_ORIGIN','https://ticket.example'],['TOROBTICKET_ADMIN_ORIGIN','http://other.example:4301'],['TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN','https://seller.example'],['TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN','http://localhost:4310']] as const) {
      const before=process.env[setting]; vi.stubEnv(setting,value); expect(localReviewEnabled()).toBe(false); expect(localSmsTestCode('http://localhost:4300')).toBeUndefined(); vi.stubEnv(setting,before);
    }
  });
});
