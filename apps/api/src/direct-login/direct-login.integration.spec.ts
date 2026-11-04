import type {IssuerState,ReferenceState} from './direct-login.state';
import type {Prisma} from '@torob-ticket/data-access';
import 'reflect-metadata';
import {ENROLLMENT_VERIFIER} from './enrollment-verifier';
import {z} from 'zod';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthorizeSchema, PartnerSchema, ProviderTrafficSchema, ReferencePageSchema, DirectAdminSchema, DirectFlowSchema, ReferralReceiptSchema, RecheckResultSchema, SearchRecoverySchema, type PartnerInput, type ReferralReceipt, type TransportSearchQuery } from '@torob-ticket/contracts';
import { accountTree, createProviderSdk, randomToken } from '@torob-ticket/provider-sdk';
import { AppModule } from '../app.module';
import { SessionService } from '../sessions/session.service';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';
const query: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
class Browser {
  cookies = new Map<string, string>();
  constructor(readonly base: string) {}
  async call(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(new URL(path, this.base), { method, redirect: 'manual', headers: { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...(body === undefined ? {} : { 'content-type': 'application/json', origin: this.base }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    for (const cookie of response.headers.getSetCookie()) { const entry = cookie.split(';')[0]!, index = entry.indexOf('='); this.cookies.set(entry.slice(0, index), entry.slice(index + 1)); }
    return response;
  }
}
describe('Direct Login over real HTTP and PostgreSQL', () => {
  let app: INestApplication, base: string;
  const owned: string[] = [];
  const independentlyWitnessed = new Set<string>();
  const independentEnrollments = new Map<string,{clientId:string;providerId:string;referralId:string;subject:string;accountId:string;phone:string;occurredAt:string;firstAccount:true}>();
  beforeAll(async () => {
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ENROLLMENT_VERIFIER).useValue({verifyCommitment:async(input:{root:string;attestation:string})=>independentlyWitnessed.has(`${input.root}:${input.attestation}`),verifyEnrollment:async(input:{clientId:string;providerId:string;referralId:string;subject:string;accountId:string;phone:string;attestation:string})=>{const record=independentEnrollments.get(input.attestation);return record&&['clientId','providerId','referralId','subject','accountId','phone'].every(key=>record[key as keyof typeof record]===input[key as keyof typeof input])?record:null;}}).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api'); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
    process.env.TOROBTICKET_SSO_ORIGIN = base; process.env.TOROBTICKET_SSO_INTERNAL_ORIGIN = base;
  });
  afterAll(async () => { await app?.get(SessionService).database.demoSession.deleteMany({ where: { id: { in: owned } } }); await app?.close(); delete process.env.TOROBTICKET_SSO_ORIGIN; delete process.env.TOROBTICKET_SSO_INTERNAL_ORIGIN; });
  async function setup() {
    const b = new Browser(base), response = await b.call('/api/v1/demo/session', { seed: 887, anchorInstant: '2026-10-25T06:00:00Z' }); expect(response.status).toBe(201);
    const hash = createHash('sha256').update(b.cookies.get('torob_demo')!).digest('hex');
    owned.push((await app.get(SessionService).database.demoSession.findUniqueOrThrow({ where: { credentialHash: hash } })).id);
    return b;
  }
  async function register(b: Browser, providerId = 'demo-provider-04', rate: number | null = 70000, kind: 'reference' | 'external' = 'reference') {
    const input: PartnerInput = { providerId, name: 'سپهر سفر', callbackUrl: kind === 'reference' ? `${base}/api/v1/reference-provider/${providerId}/callback` : 'https://seller.example/callback', loginStartUrl: kind === 'reference' ? `${base}/api/v1/reference-provider/${providerId}/start` : 'https://seller.example/start', acquisitionRateRial: rate, enabled: true, kind };
    const response = await b.call('/api/v1/admin/direct-login/partners', input); expect(response.status).toBe(201);
    return { ...z.object({partner:PartnerSchema,clientSecret:z.string()}).parse(await response.json()), input };
  }
  async function admin(b: Browser) { const r = await b.call('/api/v1/admin/direct-login'); expect(r.status).toBe(200); return DirectAdminSchema.parse(await r.json()); }
  async function phone(b: Browser, number = '+989121234567', provider?: string) {
    const prefix = provider ? `/api/v1/reference-provider/${provider}` : '/api/v1/direct-login';
    const issued = await b.call(prefix + '/phone/code', { phone: number }); expect(issued.status).toBe(201);
    const challenge = z.object({id:z.string(),expiresAt:z.string()}).parse(await issued.json()); expect(challenge).not.toHaveProperty('code');
    const message = (await admin(b)).messages.find(m => m.id === challenge.id)!; expect(message).toBeDefined();
    const verified = await b.call(prefix + '/phone/verify', { id: challenge.id, code: message.code }); expect(verified.status).toBe(201);
    return challenge;
  }
  async function receipt(b: Browser, providerId = 'demo-provider-04') {
    const start = await b.call('/api/v1/searches', { query, clientGeneration: randomUUID() }); expect(start.status).toBe(201);
    let snapshot = SearchRecoverySchema.parse(await start.json()).snapshot;
    await expect.poll(async () => { snapshot = SearchRecoverySchema.parse(await (await b.call(`/api/v1/searches/${snapshot.searchId}`)).json()).snapshot; return snapshot.status; }, { timeout: 10000, interval: 30 }).toBe('complete');
    const quote = snapshot.groups.flatMap(g => g.eligibleQuotes).find(q => q.providerId === providerId)!;
    expect(quote).toBeDefined();
    const check = RecheckResultSchema.parse(await (await b.call('/api/v1/referrals/prepare', { kind: 'transport', quoteId: quote.quoteId, quoteVersion: quote.version })).json());
    if (check.status === 'unavailable') throw Error('Expected ready quote');
    return ReferralReceiptSchema.parse(await (await b.call('/api/v1/referrals/confirm', { intentId: check.intent.intentId, acceptedQuoteVersion: check.intent.selection.quoteVersion, idempotencyKey: randomUUID() })).json());
  }
  async function begin(b: Browser, receipt: ReferralReceipt) {
    const start = await b.call(`/api/v1/direct-login/start/${receipt.referralId}`); expect(start.status).toBe(302);
    const reference = await b.call(start.headers.get('location')!); expect(reference.status).toBe(302);
    const url = new URL(reference.headers.get('location')!, base);
    const input = AuthorizeSchema.parse(Object.fromEntries(url.searchParams));
    const response = await b.call('/api/v1/direct-login/authorizations', input); expect(response.status).toBe(201);
    const redirect = z.object({redirect:z.string()}).parse(await response.json()).redirect;
    const id = redirect.split('/').at(-1)!;
    const flow = DirectFlowSchema.parse(await (await b.call(`/api/v1/direct-login/flows/${id}`)).json());
    return { input, id, flow };
  }
  async function consent(b: Browser, id: string, approved = true) { const response = await b.call(`/api/v1/direct-login/flows/${id}/consent`, { approved }); expect(response.status).toBe(201); return z.object({redirect:z.string()}).parse(await response.json()).redirect; }
  it('creates one provider account, preserves the exact offer and outbound event, and charges once across callback replays', async () => {
    const b = await setup(); await register(b); await phone(b);
    const selected = await receipt(b);
    const choice = await b.call(`/api/v1/referrals/${selected.referralId}/outbound`); expect(choice.headers.get('location')).toBe(`/direct-login/choose/${selected.referralId}`);
    const started = await begin(b, selected); expect(started.flow.existingProof).toBe(false);
    const callback = await consent(b, started.id);
    const completed = await b.call(callback); expect(completed.status).toBe(302); expect(completed.headers.get('location')).toContain(`referral=${selected.referralId}`);
    const state = await admin(b); expect(state.totals).toMatchObject({ newAccounts: 1, amountRial: '70000', pending: 0 });
    const replay = await b.call(callback); expect(replay.status).toBe(302);
    expect((await admin(b)).totals.newAccounts).toBe(1);
    const page = await b.call(completed.headers.get('location')!.replace('/reference-provider/', '/api/v1/reference-provider/')); expect(page.status).toBe(200); expect(ReferencePageSchema.parse(await page.json()).referralId).toBe(selected.referralId);
    const traffic = ProviderTrafficSchema.parse(await (await b.call('/api/v1/admin/traffic')).json()); expect(traffic.totals.outbound).toBe(1);
    const again = await begin(b, selected), againCallback = await consent(b, again.id); await b.call(againCallback);
    expect((await admin(b)).totals.newAccounts).toBe(1);
  });
  it('accepts only an owned matching account committed before the referral as existing', async () => {
    const b = await setup(); await register(b); await phone(b, '+989121234568', 'demo-provider-04'); await phone(b, '+989121234568');
    const selected = await receipt(b), started = await begin(b, selected); expect(started.flow.existingProof).toBe(true);
    const callback = await consent(b, started.id); await b.call(callback);
    const state = await admin(b); expect(state.totals).toMatchObject({ newAccounts: 0, existingAccounts: 1, amountRial: '0' }); expect(state.acquisitions[0]?.evidence).toBe('prior-commitment');
  });
  it('withholds phone on denied consent and rejects cross-reviewer flow reads', async () => {
    const b = await setup(), peer = await setup(); await register(b); await phone(b);
    const selected = await receipt(b), started = await begin(b, selected);
    expect((await peer.call(`/api/v1/direct-login/flows/${started.id}`)).status).toBe(400);
    const callback = await consent(b, started.id, false); expect(callback).not.toContain('code='); await b.call(callback);
    expect((await admin(b)).acquisitions).toHaveLength(0);
    expect(ReferencePageSchema.parse(await (await b.call('/api/v1/reference-provider/demo-provider-04')).json()).account).toBeNull();
  });
  it('uses server client authentication, exact callback, S256, one-use code and revocable UserInfo', async () => {
    const b = await setup(), registration = await register(b); await phone(b);
    const selected = await receipt(b), started = await b.call(`/api/v1/direct-login/start/${selected.referralId}`), handle = new URL(started.headers.get('location')!, base).searchParams.get('ref')!;
    const sdk = createProviderSdk({ issuer: registration.partner.issuer, clientId: registration.partner.clientId, clientSecret: registration.clientSecret, callbackUrl: registration.input.callbackUrl });
    await sdk.acceptReferral(handle);
    const pending = sdk.begin(handle), input = AuthorizeSchema.parse(Object.fromEntries(new URL(pending.url).searchParams));
    expect((await b.call('/api/v1/direct-login/authorizations', { ...input, redirect_uri: 'https://attacker.example/callback' })).status).toBe(400);
    const created = await b.call('/api/v1/direct-login/authorizations', input), id = z.object({redirect:z.string()}).parse(await created.json()).redirect.split('/').at(-1)!;
    const callback = new URL(await consent(b, id));
    const body = { grant_type: 'authorization_code', client_id: registration.partner.clientId, client_secret: registration.clientSecret, code: callback.searchParams.get('code'), redirect_uri: registration.input.callbackUrl, code_verifier: pending.transaction.verifier };
    const exchange = (payload: object) => fetch(base + '/api/v1/direct-login/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    expect((await exchange({ ...body, code_verifier: randomToken() })).status).toBe(400);
    expect((await exchange({ ...body, client_secret: randomToken() })).status).toBe(401);
    const response = await exchange(body); expect(response.status).toBe(200); const tokens = z.object({id_token:z.string(),access_token:z.string()}).parse(await response.json());
    const claims = JSON.parse(Buffer.from(tokens.id_token.split('.')[1]!, 'base64url').toString()); expect(claims.phone_number).toBe('+989121234567');
    expect((await exchange(body)).status).toBe(400);
    const info = () => fetch(`${registration.partner.issuer}/userinfo`, { headers: { authorization: `Bearer ${tokens.access_token}` } });
    expect((await info()).status).toBe(200);
    await b.call('/api/v1/direct-login/logout', {}); expect((await info()).status).toBe(401);
    const keys = z.object({keys:z.array(z.record(z.string(),z.unknown()))}).parse(await (await fetch(`${registration.partner.issuer}/jwks`)).json()); expect(keys.keys[0]).not.toHaveProperty('d');
  });
  it('bounds OTP guesses, throttles resend, rejects foreign browser and prevents OTP replay', async () => {
    const b = await setup(), issued = await b.call('/api/v1/direct-login/phone/code', { phone: '+989121234569' }), challenge = z.object({id:z.string()}).parse(await issued.json());
    const actual = (await admin(b)).messages.find(m => m.id === challenge.id)!.code;
    expect((await b.call('/api/v1/direct-login/phone/code', { phone: '+989121234569' })).status).toBe(409);
    const impostor = new Browser(base); impostor.cookies.set('torob_demo', b.cookies.get('torob_demo')!);
    expect((await impostor.call('/api/v1/direct-login/phone/verify', { id: challenge.id, code: actual })).status).toBe(400);
    const wrong = actual === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) expect((await b.call('/api/v1/direct-login/phone/verify', { id: challenge.id, code: wrong })).status).toBe(400);
    expect((await b.call('/api/v1/direct-login/phone/verify', { id: challenge.id, code: actual })).status).toBe(400);
    expect((await admin(b)).messages).toHaveLength(0);
  });
  it('keeps external self-reports pending and rejects existing=true as a disclosure shortcut', async () => {
    const b = await setup(), reg = await register(b, 'demo-provider-04', null, 'external'); await phone(b);
    const selected = await receipt(b), redirected = await b.call(`/api/v1/direct-login/start/${selected.referralId}`), handle = new URL(redirected.headers.get('location')!).searchParams.get('ref')!;
    const sdk = createProviderSdk({ issuer: reg.partner.issuer, clientId: reg.partner.clientId, clientSecret: reg.clientSecret, callbackUrl: reg.input.callbackUrl });
    const pending = sdk.begin(handle), input = AuthorizeSchema.parse(Object.fromEntries(new URL(pending.url).searchParams));
    expect((await b.call('/api/v1/direct-login/authorizations', { ...input, existing: true })).status).toBe(400);
    await sdk.acceptReferral(handle);
    const auth = await b.call('/api/v1/direct-login/authorizations', input), id = z.object({redirect:z.string()}).parse(await auth.json()).redirect.split('/').at(-1)!;
    const claims = await sdk.finish(new URL(await consent(b, id)), pending.transaction);
    await sdk.reportAccount(selected.referralId, claims.sub, 'claimed-account');
    expect((await admin(b)).totals).toMatchObject({ newAccounts: 0, amountRial: '0', pending: 1 });
  });
  it('witnesses ordinary signup after consent even when the provider completion callback is omitted', async () => {
    const b = await setup(); await register(b); await phone(b, '+989121234570');
    const selected = await receipt(b), started = await begin(b, selected); await consent(b, started.id);
    await phone(b, '+989121234570', 'demo-provider-04');
    const evidence = await admin(b); expect(evidence.totals).toMatchObject({newAccounts:1,amountRial:'70000',pending:0});
    expect(evidence.acquisitions[0]?.evidence).toBe('local-enrollment');
  });
  it('keeps contact private when an external provider submits an unverified precommitted roster', async () => {
    const b = await setup(), reg = await register(b,'demo-provider-04',70000,'external');
    const sdk = createProviderSdk({issuer:reg.partner.issuer,clientId:reg.partner.clientId,clientSecret:reg.clientSecret,callbackUrl:reg.input.callbackUrl});
    const tree=accountTree('demo-provider-04',[{id:'made-up-account',phone:'+989121234571',salt:randomToken()}]);
    const published=await sdk.publishCommitment(tree.root,'provider-self-assertion'); expect(published.verified).toBe(false);
    const selected=await receipt(b), redirected=await b.call(`/api/v1/direct-login/start/${selected.referralId}`), handle=new URL(redirected.headers.get('location')!).searchParams.get('ref')!;
    await expect(sdk.proveExisting(handle,tree.proof('made-up-account'))).rejects.toThrow();
    expect((await admin(b)).totals.newAccounts).toBe(0);
  });
  it('rejects a cross-origin consent mutation and an offer wrapped in a different provider identity', async () => {
    const b=await setup(); await register(b); await register(b,'demo-provider-01');
    const selected=await receipt(b);
    expect((await b.call(`/api/v1/reference-provider/demo-provider-01?referral=${selected.referralId}`)).status).toBe(404);
    const cookie=[...b.cookies].map(([k,v])=>`${k}=${v}`).join('; ');
    const response=await fetch(base+'/api/v1/direct-login/phone/code',{method:'POST',headers:{cookie,origin:'https://attacker.example','content-type':'application/json'},body:JSON.stringify({phone:'+989121234571'})});
    expect(response.status).toBe(403);
  });
  it('upgrades a verified commitment prospectively and proves one external customer without a roster disclosure', async () => {
    const b=await setup(), reg=await register(b,'demo-provider-04',null,'external'); await phone(b,'+989121234572');
    const sdk=createProviderSdk({issuer:reg.partner.issuer,clientId:reg.partner.clientId,clientSecret:reg.clientSecret,callbackUrl:reg.input.callbackUrl});
    const tree=accountTree('demo-provider-04',[{id:'known-account',phone:'+989121234572',salt:randomToken()}]);
    expect((await sdk.publishCommitment(tree.root,'unverified')).verified).toBe(false);
    const oldReceipt=await receipt(b), oldRedirect=await b.call(`/api/v1/direct-login/start/${oldReceipt.referralId}`), oldHandle=new URL(oldRedirect.headers.get('location')!).searchParams.get('ref')!;
    const attestation=randomToken(); independentlyWitnessed.add(`${tree.root}:${attestation}`);
    expect((await sdk.publishCommitment(tree.root,attestation)).verified).toBe(true);
    await expect(sdk.proveExisting(oldHandle,tree.proof('known-account'))).rejects.toThrow();
    const selected=await receipt(b), redirect=await b.call(`/api/v1/direct-login/start/${selected.referralId}`), handle=new URL(redirect.headers.get('location')!).searchParams.get('ref')!;
    await sdk.proveExisting(handle,tree.proof('known-account'));
    const started=sdk.begin(handle), input=AuthorizeSchema.parse(Object.fromEntries(new URL(started.url).searchParams));
    const authorized=await b.call('/api/v1/direct-login/authorizations',input), id=z.object({redirect:z.string()}).parse(await authorized.json()).redirect.split('/').at(-1)!;
    const flow=DirectFlowSchema.parse(await (await b.call(`/api/v1/direct-login/flows/${id}`)).json()); expect(flow.existingProof).toBe(true);
    const claims=await sdk.finish(new URL(await consent(b,id)),started.transaction); expect(claims.attribution).toBe('existing');
    expect((await admin(b)).totals.existingAccounts).toBe(1);
    const malformed=await b.call('/api/v1/direct-login/account-events',{client_id:reg.partner.clientId,client_secret:reg.clientSecret,referral_id:selected.referralId,sub:claims.sub,account_id:''});
    expect(malformed.status).toBe(400); expect((await admin(b)).totals.existingAccounts).toBe(1);
  });
  it('keeps local commitments and enrollment evidence out of a later external connection', async () => {
    const b=await setup(); await register(b); await phone(b,'+989121234573');
    const original=await receipt(b); await begin(b,original);
    await phone(b,'+989121234573','demo-provider-04');
    const db=app.get(SessionService).database, hash=createHash('sha256').update(b.cookies.get('torob_demo')!).digest('hex');
    const scope=await db.demoSession.findUniqueOrThrow({where:{credentialHash:hash}});
    const provider=(await db.referenceProviderWorkspace.findUniqueOrThrow({where:{sessionId:scope.id}})).payload as unknown as ReferenceState;
    const account=provider.accounts.find(a=>a.phone==='+989121234573')!;
    const oldProof=accountTree('demo-provider-04',[account]).proof(account.id);
    const reg=await register(b,'demo-provider-04',70000,'external');
    const sdk=createProviderSdk({issuer:reg.partner.issuer,clientId:reg.partner.clientId,clientSecret:reg.clientSecret,callbackUrl:reg.input.callbackUrl});
    const later=await receipt(b), laterStart=await b.call(`/api/v1/direct-login/start/${later.referralId}`), laterHandle=new URL(laterStart.headers.get('location')!).searchParams.get('ref')!;
    await expect(sdk.proveExisting(laterHandle,oldProof)).rejects.toThrow();
    const restart=await b.call(`/api/v1/direct-login/start/${original.referralId}`), handle=new URL(restart.headers.get('location')!).searchParams.get('ref')!;
    await sdk.acceptReferral(handle);
    const pending=sdk.begin(handle), input=AuthorizeSchema.parse(Object.fromEntries(new URL(pending.url).searchParams));
    const auth=await b.call('/api/v1/direct-login/authorizations',input), id=z.object({redirect:z.string()}).parse(await auth.json()).redirect.split('/').at(-1)!;
    const claims=await sdk.finish(new URL(await consent(b,id)),pending.transaction);
    await sdk.reportAccount(original.referralId,claims.sub,account.id);
    expect((await admin(b)).totals).toMatchObject({newAccounts:0,pending:1,amountRial:'0'});
  });
  it('charges an external account only after independent enrollment authority and never charges its replay', async () => {
    const b=await setup(), reg=await register(b,'demo-provider-04',70000,'external'); await phone(b,'+989121234574');
    const sdk=createProviderSdk({issuer:reg.partner.issuer,clientId:reg.partner.clientId,clientSecret:reg.clientSecret,callbackUrl:reg.input.callbackUrl});
    const selected=await receipt(b), redirect=await b.call(`/api/v1/direct-login/start/${selected.referralId}`), handle=new URL(redirect.headers.get('location')!).searchParams.get('ref')!;
    await sdk.acceptReferral(handle);
    const pending=sdk.begin(handle), input=AuthorizeSchema.parse(Object.fromEntries(new URL(pending.url).searchParams));
    const auth=await b.call('/api/v1/direct-login/authorizations',input), id=z.object({redirect:z.string()}).parse(await auth.json()).redirect.split('/').at(-1)!;
    const claims=await sdk.finish(new URL(await consent(b,id)),pending.transaction), attestation=randomToken();
    const evidence={clientId:reg.partner.clientId,providerId:'demo-provider-04',referralId:selected.referralId,subject:claims.sub,accountId:'verified-account',phone:'+989121234574',occurredAt:'1970-01-01T00:00:00.000Z',firstAccount:true as const};
    independentEnrollments.set(attestation,evidence);
    await sdk.reportAccount(selected.referralId,claims.sub,evidence.accountId,attestation);
    expect((await admin(b)).totals.newAccounts).toBe(0);
    independentEnrollments.set(attestation,{...evidence,occurredAt:new Date(Date.now()+660000).toISOString()});
    await sdk.reportAccount(selected.referralId,claims.sub,evidence.accountId,attestation);
    expect((await admin(b)).totals.newAccounts).toBe(0);
    independentEnrollments.set(attestation,{...evidence,occurredAt:new Date().toISOString()});
    await sdk.reportAccount(selected.referralId,claims.sub,evidence.accountId,attestation);
    const confirmed=await admin(b); expect(confirmed.totals).toMatchObject({newAccounts:1,amountRial:'70000',pending:0}); expect(confirmed.acquisitions[0]?.evidence).toBe('verified-enrollment');
    await sdk.reportAccount(selected.referralId,claims.sub,evidence.accountId,attestation);
    expect((await admin(b)).totals.newAccounts).toBe(1);
  });
  it('uses the opted-in local SMS code for TorobTicket and provider challenges with browser, purpose and one-use checks', async () => {
    const previous=process.env.TOROBTICKET_SSO_TEST_SMS_CODE;
    process.env.TOROBTICKET_SSO_TEST_SMS_CODE='123456';
    try {
      const b=await setup(); await register(b);
      for(const provider of [undefined,'demo-provider-04']) {
        const prefix=provider?`/api/v1/reference-provider/${provider}`:'/api/v1/direct-login';
        const issued=await b.call(prefix+'/phone/code',{phone:'+989000000011'});
        expect(issued.status).toBe(201);
        const challenge=z.object({id:z.string()}).parse(await issued.json());
        expect((await admin(b)).messages.find(m=>m.id===challenge.id)?.code).toBe('123456');
        const foreign=new Browser(base); foreign.cookies.set('torob_demo',b.cookies.get('torob_demo')!);
        expect((await foreign.call(prefix+'/phone/verify',{id:challenge.id,code:'123456'})).status).toBe(400);
        const wrongPurpose=provider?'/api/v1/direct-login':'/api/v1/reference-provider/demo-provider-04';
        expect((await b.call(wrongPurpose+'/phone/verify',{id:challenge.id,code:'123456'})).status).toBe(400);
        expect((await b.call(prefix+'/phone/verify',{id:challenge.id,code:'123456'})).status).toBe(201);
        expect((await b.call(prefix+'/phone/verify',{id:challenge.id,code:'123456'})).status).toBe(400);
      }
    } finally {if(previous===undefined)delete process.env.TOROBTICKET_SSO_TEST_SMS_CODE;else process.env.TOROBTICKET_SSO_TEST_SMS_CODE=previous;}
  });
  it('revokes test-code redemption when the mode is disabled, enforces expiry and preserves older random challenges', async () => {
    const previous=process.env.TOROBTICKET_SSO_TEST_SMS_CODE, previousMode=process.env.NODE_ENV;
    try {
      const b=await setup();
      delete process.env.TOROBTICKET_SSO_TEST_SMS_CODE;
      const legacy=z.object({id:z.string()}).parse(await (await b.call('/api/v1/direct-login/phone/code',{phone:'+989000000012'})).json());
      const legacyCode=(await admin(b)).messages.find(m=>m.id===legacy.id)!.code;
      process.env.TOROBTICKET_SSO_TEST_SMS_CODE='123456';
      expect((await b.call('/api/v1/direct-login/phone/verify',{id:legacy.id,code:legacyCode})).status).toBe(201);
      const issued=z.object({id:z.string()}).parse(await (await b.call('/api/v1/direct-login/phone/code',{phone:'+989000000013'})).json());
      process.env.NODE_ENV='production';
      expect((await b.call('/api/v1/direct-login/phone/verify',{id:issued.id,code:'123456'})).status).toBe(400);
      process.env.NODE_ENV='test'; delete process.env.TOROBTICKET_SSO_TEST_SMS_CODE;
      expect((await b.call('/api/v1/direct-login/phone/verify',{id:issued.id,code:'123456'})).status).toBe(400);
      process.env.TOROBTICKET_SSO_TEST_SMS_CODE='123456';
      const db=app.get(SessionService).database, stored=await db.directLoginWorkspace.findUniqueOrThrow({where:{sessionId:owned.at(-1)!}}), state=stored.payload as unknown as IssuerState;
      state.challenges.find(c=>c.id===issued.id)!.expires=Date.now()-1;
      await db.directLoginWorkspace.update({where:{sessionId:owned.at(-1)!},data:{payload:state as unknown as Prisma.InputJsonValue}});
      expect((await b.call('/api/v1/direct-login/phone/verify',{id:issued.id,code:'123456'})).status).toBe(400);
    } finally {
      if(previous===undefined)delete process.env.TOROBTICKET_SSO_TEST_SMS_CODE;else process.env.TOROBTICKET_SSO_TEST_SMS_CODE=previous;
      if(previousMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousMode;
    }
  });
  it('revokes grants and provider browser sessions on scoped reset without affecting a peer', async () => {
    const b = await setup(), peer = await setup(), reg = await register(b); await register(peer); await phone(b);
    const selected = await receipt(b), started = await begin(b, selected); await consent(b, started.id);
    expect((await b.call('/api/v1/demo/reset', {})).status).toBe(201);
    expect((await fetch(reg.partner.issuer + '/jwks')).status).toBe(401);
    expect((await admin(peer)).partners).toHaveLength(1);
    const db = app.get(SessionService).database; expect(await db.directLoginClient.count({ where: { clientId: reg.partner.clientId } })).toBe(0);
    const hash = createHash('sha256').update(b.cookies.get('torob_demo')!).digest('hex'); owned.push((await db.demoSession.findUniqueOrThrow({ where: { credentialHash: hash } })).id);
  });
  it('requires traveler scope completion, snapshots approved domestic fields, and keeps phone-only grants minimal', async () => {
    const b = await setup(), reg = await register(b, 'demo-provider-04', null, 'external'); await phone(b);
    const selected = await receipt(b), redirected = await b.call(`/api/v1/direct-login/start/${selected.referralId}`), handle = new URL(redirected.headers.get('location')!).searchParams.get('ref')!;
    const sdk = createProviderSdk({ issuer: reg.partner.issuer, clientId: reg.partner.clientId, clientSecret: reg.clientSecret, callbackUrl: reg.input.callbackUrl, scope: 'openid phone traveler' });
    await sdk.acceptReferral(handle);
    const pending = sdk.begin(handle), created = await b.call('/api/v1/direct-login/authorizations', AuthorizeSchema.parse(Object.fromEntries(new URL(pending.url).searchParams)));
    const id = z.object({redirect:z.string()}).parse(await created.json()).redirect.split('/').at(-1)!;
    const details=DirectFlowSchema.parse(await(await b.call(`/api/v1/direct-login/flows/${id}`)).json());
    expect(details).toMatchObject({profileRequired:true,travelContext:{international:false,travelDate:'2026-10-25'}});
    expect((await b.call(`/api/v1/direct-login/flows/${id}/consent`,{approved:true})).status).toBe(400);
    const profile={givenName:'مسافر',familyName:'ایرانی',birthDate:'1992-03-04',gender:'female',nationality:'IR',nationalId:'0012345678',latinGivenName:'Mosafer',latinFamilyName:'Irani',passport:{number:'A12345678',issuingCountry:'IR',expiresOn:'2028-01-01'}};
    expect((await b.call('/api/v1/direct-login/profile',profile)).status).toBe(201);
    const callback=new URL(await consent(b,id));
    await b.call('/api/v1/direct-login/profile',{...profile,givenName:'تغییر'});
    const exchange=await fetch(base+'/api/v1/direct-login/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grant_type:'authorization_code',client_id:reg.partner.clientId,client_secret:reg.clientSecret,redirect_uri:reg.input.callbackUrl,code_verifier:pending.transaction.verifier,code:callback.searchParams.get('code')})});
    expect(exchange.status).toBe(200);const tokens=await exchange.json() as {id_token:string;access_token:string};
    const claims=JSON.parse(Buffer.from(tokens.id_token.split('.')[1]!,'base64url').toString());
    expect(claims.traveler_profile.givenName).toBe('مسافر');expect(claims.traveler_profile).not.toHaveProperty('passport');expect(claims.traveler_profile).not.toHaveProperty('latinGivenName');
    const userinfo=z.object({traveler_profile:z.unknown()}).parse(await(await fetch(reg.partner.issuer+'/userinfo',{headers:{authorization:'Bearer '+tokens.access_token}})).json());expect(userinfo.traveler_profile).toEqual(claims.traveler_profile);
    const phoneSdk=createProviderSdk({issuer:reg.partner.issuer,clientId:reg.partner.clientId,clientSecret:reg.clientSecret,callbackUrl:reg.input.callbackUrl});
    const next=phoneSdk.begin(handle),auth=await b.call('/api/v1/direct-login/authorizations',AuthorizeSchema.parse(Object.fromEntries(new URL(next.url).searchParams)));
    const nextId=z.object({redirect:z.string()}).parse(await auth.json()).redirect.split('/').at(-1)!;
    expect(await phoneSdk.finish(new URL(await consent(b,nextId)),next.transaction)).not.toHaveProperty('traveler_profile');
    const peer=await setup();expect((await peer.call('/api/v1/direct-login/profile',profile)).status).toBe(401);
    expect((await b.call('/api/v1/direct-login/profile',{...profile,passport:{...profile.passport,verified:true}})).status).toBe(400);
  });

  it('installs through a one-use code and refuses activation after an intervening revision', async () => {
    const b=await setup(),original=globalThis.fetch;
    const clientIds:string[]=[];let race=false;
    process.env.TOROBTICKET_EXAMPLE_PROVIDER_INTERNAL_ORIGIN='http://127.0.0.1:59998';
    const intercepted=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
      const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
      if(url.origin!=='http://127.0.0.1:59998')return original(input,init);
      const body=JSON.parse(String(init?.body)) as {clientId:string;code:string};clientIds.push(body.clientId);
      const row=await app.get(SessionService).database.directLoginClient.findUniqueOrThrow({where:{clientId:body.clientId}});expect(row.enabled).toBe(false);
      const exchange=()=>original(base+'/api/v1/direct-login/example-registration',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_id:body.clientId,code:body.code})});
      const installed=await exchange();expect(installed.status).toBe(201);const configuration=z.object({revision:z.number(),callbackUrl:z.string()}).parse(await installed.json());expect(configuration.revision).toBe(row.revision);expect(configuration.callbackUrl).toBe('http://localhost:4310/callback');
      expect((await exchange()).status).toBe(400);
      if(race)await app.get(SessionService).database.directLoginClient.update({where:{clientId:body.clientId},data:{revision:{increment:1}}});
      return new Response(JSON.stringify({installed:true,clientId:body.clientId}),{headers:{'content-type':'application/json'}});
    });
    try {
      const connected=await b.call('/api/v1/admin/direct-login/example-provider',{providerId:'demo-provider-04',name:'سپهر سفر'});expect(connected.status).toBe(201);
      const result=z.object({partner:PartnerSchema}).parse(await connected.json());expect(result.partner.enabled).toBe(true);expect(result.partner.exampleSiteUrl).toBe('http://localhost:4310/providers/'+clientIds[0]);expect(result).not.toHaveProperty('clientSecret');
      race=true;expect((await b.call('/api/v1/admin/direct-login/example-provider',{providerId:'demo-provider-04',name:'سپهر سفر'})).status).toBe(400);
      expect((await app.get(SessionService).database.directLoginClient.findUniqueOrThrow({where:{clientId:clientIds[0]}})).enabled).toBe(false);
    } finally {intercepted.mockRestore();delete process.env.TOROBTICKET_EXAMPLE_PROVIDER_INTERNAL_ORIGIN;}
  });

});
