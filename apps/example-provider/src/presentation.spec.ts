import { describe, expect, it } from 'vitest';
import type { IdentityClaims } from '@torob-ticket/provider-sdk';
import { accountContent } from './presentation';

const claims: IdentityClaims = { iss: 'http://localhost:4300/api/v1/direct-login/issuer/client', aud: 'client', sub: 'approved-subject', exp: 2000000000, iat: 1999999900, nonce: 'bound-nonce', phone_number: '+989000000001', phone_number_verified: true, referral_id: 'accepted-referral', attribution: 'pending' };
const account = { id: 'provider-account', createdAt: '2026-11-06T00:00:00Z' };
const render = (identity: IdentityClaims) => accountContent({ claims: identity, account, accountStatus: 'existing', clientId: 'registered-client', logoutCsrf: 'session-bound-token', issuerOrigin: 'http://localhost:4300' });

describe('approved provider profile presentation', () => {
  it('keeps a phone-only identity usable without inventing traveler documents or a name', () => {
    const html = render(claims);
    expect(html).toContain('خوش آمدید، مسافر');
    expect(html).toContain('<dt>شمارهٔ همراه</dt><dd dir="ltr">+989000000001</dd>');
    expect(html).not.toContain('<dt>کد ملی</dt>');
    expect(html).not.toContain('<dt>شمارهٔ گذرنامه</dt>');
    expect(html).not.toContain('<dt>تاریخ تولد · میلادی</dt>');
    expect(html).toContain('&quot;attribution&quot;: &quot;pending&quot;');
  });

  it('renders only the approved international document and escapes human-readable claims as well as JSON', () => {
    const html = render({ ...claims, traveler_profile: { givenName: '<script>name</script>', familyName: 'ایرانی', birthDate: '1992-03-04', nationality: 'IR', gender: 'unspecified', passport: { number: 'A1234567', issuingCountry: 'IR', expiresOn: '2030-01-01' } } });
    expect(html).toContain('<dt>شمارهٔ گذرنامه</dt><dd dir="ltr">A1234567</dd>');
    expect(html).toContain('خوش آمدید، &lt;script&gt;name&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<dt>کد ملی</dt>');
    expect(html).toContain('id="sso-response"');
    expect(html).toContain('name="csrf" value="session-bound-token"');
  });
});
