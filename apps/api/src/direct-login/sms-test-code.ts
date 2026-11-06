import { localReviewEnabled } from './local-review';
/** Local verification convenience, enabled explicitly by development or the local reviewer stack. */
export function localSmsTestCode(origin: string): '123456' | undefined {
  const optedIn = process.env.TOROBTICKET_SSO_TEST_SMS_CODE === '123456';
  const development = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname);
  return optedIn && (development || localReviewEnabled(origin)) && loopback ? '123456' : undefined;
}
