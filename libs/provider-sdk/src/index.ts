import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto';
export interface CommitmentProof { accountId: string; salt: string; root: string; siblings: { hash: string; left: boolean }[] }

export const randomToken = () => randomBytes(32).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const pkceChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');
export function constantEqual(a: string, b: string) {
  const first = Buffer.from(a), second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
export function accountLeaf(providerId: string, accountId: string, phone: string, salt: string) {
  return createHash('sha256').update(Buffer.concat([Buffer.from([0]), Buffer.from(JSON.stringify([providerId, accountId, phone, salt]))])).digest('hex');
}
function parent(left: string, right: string) { return createHash('sha256').update(Buffer.concat([Buffer.from([1]), Buffer.from(left, 'hex'), Buffer.from(right, 'hex')])).digest('hex'); }
export function accountTree(providerId: string, accounts: { id: string; phone: string; salt: string }[]) {
  const records = [...accounts].sort((a, b) => a.id.localeCompare(b.id));
  const leaves = records.map(a => accountLeaf(providerId, a.id, a.phone, a.salt));
  function root(nodes: string[]): string {
    if (!nodes.length) return sha256('');
    if (nodes.length === 1) return nodes[0]!;
    const split = 2 ** Math.floor(Math.log2(nodes.length - 1));
    return parent(root(nodes.slice(0, split)), root(nodes.slice(split)));
  }
  function path(nodes: string[], index: number): CommitmentProof['siblings'] {
    if (nodes.length === 1) return [];
    const split = 2 ** Math.floor(Math.log2(nodes.length - 1));
    return index < split ? [...path(nodes.slice(0, split), index), { hash: root(nodes.slice(split)), left: false }] : [...path(nodes.slice(split), index - split), { hash: root(nodes.slice(0, split)), left: true }];
  }
  return { root: root(leaves), proof(accountId: string): CommitmentProof {
    const index = records.findIndex(a => a.id === accountId), account = records[index];
    if (!account) throw new Error('Unknown account');
    return { accountId, salt: account.salt, root: root(leaves), siblings: path(leaves, index) };
  } };
}
export function verifyAccountProof(providerId: string, phone: string, proof: CommitmentProof) {
  let hash = accountLeaf(providerId, proof.accountId, phone, proof.salt);
  for (const node of proof.siblings) hash = node.left ? parent(node.hash, hash) : parent(hash, node.hash);
  return constantEqual(hash, proof.root);
}

export interface ProviderConfiguration {
  issuer: string; clientId: string; clientSecret: string; callbackUrl: string;
  /** Supply a bounded HTTP transport for the provider backend. */
  transport?: typeof fetch;
}
export interface LoginTransaction { state: string; nonce: string; verifier: string; referral: string; createdAt: number }
export interface IdentityClaims { iss: string; aud: string; sub: string; exp: number; iat: number; nonce: string; phone_number: string; phone_number_verified: true; referral_id: string; attribution: 'existing' | 'pending' }
/** Backend only. Persist the transaction under a random HttpOnly browser cookie.
 * Consume that transaction atomically before redeeming a callback. Never use a
 * query-string state value as its own expected state. */
export function createProviderSdk(config: ProviderConfiguration) {
  const transport = config.transport ?? fetch;
  async function read(url: string, init?: RequestInit) {
    const response = await transport(url, { ...init, signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) throw new Error('TorobTicket authentication failed');
    return response.json() as Promise<Record<string, unknown>>;
  }
  return {
    begin(referral: string) {
      const transaction: LoginTransaction = { state: randomToken(), nonce: randomToken(), verifier: randomToken(), referral, createdAt: Date.now() };
      const url = new URL('/direct-login/begin', config.issuer);
      url.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.callbackUrl, scope: 'openid phone', state: transaction.state, nonce: transaction.nonce, code_challenge: pkceChallenge(transaction.verifier), code_challenge_method: 'S256', ref: referral }).toString();
      return { transaction, url: url.href };
    },
    async acceptReferral(referral: string) {
      return read(`${config.issuer.slice(0, config.issuer.indexOf('/issuer/'))}/acknowledgments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, ref: referral }) });
    },
    async publishCommitment(root: string, attestation: string) {
      return read(`${config.issuer.slice(0, config.issuer.indexOf('/issuer/'))}/commitments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, root, attestation }) });
    },
    async proveExisting(referral: string, proof: CommitmentProof) {
      return read(`${config.issuer.slice(0, config.issuer.indexOf('/issuer/'))}/existing-proofs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, ref: referral, proof }) });
    },
    async reportAccount(referralId: string, subject: string, accountId: string, attestation = '') {
      return read(`${config.issuer.slice(0, config.issuer.indexOf('/issuer/'))}/account-events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, referral_id: referralId, sub: subject, account_id: accountId, attestation }) });
    },
    async finish(callback: URL, expected: LoginTransaction): Promise<IdentityClaims> {
      const registered = new URL(config.callbackUrl);
      if (callback.origin !== registered.origin || callback.pathname !== registered.pathname) throw new Error('Invalid callback destination');
      if (Date.now() - expected.createdAt > 600000 || !constantEqual(callback.searchParams.get('state') ?? '', expected.state) || callback.searchParams.getAll('state').length !== 1 || callback.searchParams.getAll('code').length !== 1 || callback.searchParams.has('error')) throw new Error('Invalid login callback');
      const token = await read(`${config.issuer.slice(0, config.issuer.indexOf('/issuer/'))}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callbackUrl, code_verifier: expected.verifier, code: callback.searchParams.get('code') ?? '' }) });
      if (typeof token.id_token !== 'string') throw new Error('Missing identity token');
      const parts = token.id_token.split('.');
      if (parts.length !== 3) throw new Error('Invalid identity token');
      const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString()) as { alg: string; kid: string };
      const jwks = await read(`${config.issuer}/jwks`) as { keys?: { kid: string; kty: string; crv: string; x: string }[] };
      const key = jwks.keys?.find(k => k.kid === header.kid && k.kty === 'OKP' && k.crv === 'Ed25519');
      if (header.alg !== 'EdDSA' || !key || !verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2]!, 'base64url'))) throw new Error('Invalid identity signature');
      const claims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()) as IdentityClaims;
      const now = Math.floor(Date.now() / 1000);
      if (claims.iss !== config.issuer || claims.aud !== config.clientId || claims.nonce !== expected.nonce || typeof claims.sub !== 'string' || !claims.sub || typeof claims.iat !== 'number' || claims.iat > now + 30 || typeof claims.exp !== 'number' || claims.exp <= now || claims.exp > claims.iat + 300 || typeof claims.phone_number !== 'string' || claims.phone_number_verified !== true || typeof claims.referral_id !== 'string' || !['existing', 'pending'].includes(claims.attribution)) throw new Error('Invalid identity claims');
      return claims;
    }
  };
}
