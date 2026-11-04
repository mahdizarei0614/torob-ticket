import { afterEach, describe, expect, it, vi } from 'vitest';
import { localSmsTestCode } from './sms-test-code';

afterEach(() => vi.unstubAllEnvs());

describe('local SMS verification code', () => {
  it.each([
    ['development', '123456', 'http://127.0.0.1:4300', '123456'],
    ['test', '123456', 'http://localhost:4300', '123456'],
    ['development', '123456', 'http://[::1]:4300', '123456'],
    ['production', '123456', 'http://localhost:4300', undefined],
    ['development', undefined, 'http://localhost:4300', undefined],
    ['test', '654321', 'http://localhost:4300', undefined],
    ['development', '123456', 'https://ticket.example', undefined],
    ['test', '123456', 'https://localhost.attacker.example', undefined],
  ])('gates the code for mode %s, setting %s, origin %s', (mode, setting, origin, expected) => {
    vi.stubEnv('NODE_ENV', mode);
    vi.stubEnv('TOROBTICKET_SSO_TEST_SMS_CODE', setting);
    expect(localSmsTestCode(origin)).toBe(expected);
  });
});
