import { describe, expect, it } from 'vitest';
import { accountTree, createProviderSdk, pkceChallenge, randomToken, verifyAccountProof } from './index';

describe('provider SDK proof and browser transaction boundaries', () => {
  it('binds a precommitted proof to one phone, account and provider at every tree shape', () => {
    for (const count of [1, 2, 3, 5, 8, 17]) {
      const accounts = Array.from({ length: count }, (_, i) => ({ id: `account-${i}`, phone: `+9891212345${String(i).padStart(2, '0')}`, salt: randomToken() }));
      const tree = accountTree('provider-a', accounts);
      for (const account of accounts) {
        const proof = tree.proof(account.id);
        expect(verifyAccountProof('provider-a', account.phone, proof)).toBe(true);
        expect(verifyAccountProof('provider-b', account.phone, proof)).toBe(false);
        expect(verifyAccountProof('provider-a', '+989000000000', proof)).toBe(false);
        expect(verifyAccountProof('provider-a', account.phone, { ...proof, accountId: 'invented' })).toBe(false);
      }
    }
  });
  it('uses S256 with independent state and nonce and refuses a foreign callback before any request', async () => {
    let requests = 0;
    const sdk = createProviderSdk({ issuer: 'https://ticket.example/api/v1/direct-login/issuer/client', clientId: 'client', clientSecret: randomToken(), callbackUrl: 'https://seller.example/callback', transport: async () => { requests++; throw Error('must not fetch'); } });
    const start = sdk.begin(randomToken()), url = new URL(start.url);
    expect(url.searchParams.get('code_challenge')).toBe(pkceChallenge(start.transaction.verifier));
    expect(start.transaction.state).not.toBe(start.transaction.nonce);
    expect(start.url).not.toContain(start.transaction.verifier);
    await expect(sdk.finish(new URL('https://seller.example/callback?state=wrong&code=code'), start.transaction)).rejects.toThrow('Invalid login callback');
    expect(requests).toBe(0);
  });
});
