import { configuredOrigin, configuredAdminOrigin } from './issuer-origin';
export { configuredOrigin } from './issuer-origin';
import {exampleProviderOrigin,exampleProviderInternalOrigin} from './example-provider-config';
import {travelerProfileForTrip,localDateAt} from '@torob-ticket/domain';
import {ENROLLMENT_VERIFIER,type EnrollmentVerifier} from './enrollment-verifier';
import { localSmsTestCode } from './sms-test-code';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac, generateKeyPairSync, randomInt, randomUUID, sign } from 'node:crypto';
import { ReferralReceiptSchema, type TravelerProfile, type TravelContext, type AuthorizeInput, type CommitmentProof, type PartnerInput, type ReferralReceipt } from '@torob-ticket/contracts';
import { scopedTransaction, type DataScope, type Prisma } from '@torob-ticket/data-access';
import { accountTree, constantEqual, createProviderSdk, pkceChallenge, randomToken, sha256, verifyAccountProof } from '@torob-ticket/provider-sdk';
import { catalogForIdentity } from '@torob-ticket/fixtures';
import { SessionService } from '../sessions/session.service';
import type { CookieResponse, SessionContext, SessionRequest } from '../sessions/session-context';
import type { Acquisition, Flow, IssuerState, ReferenceState } from './direct-login.state';

const invalid = (message = 'This sign-in request is invalid or has expired.') => new BadRequestException({ code: 'DIRECT_LOGIN_INVALID', message });
const emptyProvider = (): ReferenceState => ({ enrollments: [], credentials: [], accounts: [], sessions: [], transactions: [], outbox: [] });
function newIssuer(): IssuerState {
  const keys = generateKeyPairSync('ed25519');
  return { version: 1, sequence: 0, privateKey: keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), publicKey: keys.publicKey.export({ format: 'jwk' }) as Record<string, string>, kid: randomUUID(), subjectSecret: randomToken(), identities: [], challenges: [], sessions: [], references: [], flows: [], snapshots: [], acknowledgments: [], acquisitions: [], access: [] };
}
interface WebRequest extends SessionRequest { method?: string; headers: SessionRequest['headers'] & { origin?: string; 'sec-fetch-site'?: string; authorization?: string } }
@Injectable()
export class DirectLoginService {
  constructor(@Inject(SessionService) private readonly sessions: SessionService, @Inject(ENROLLMENT_VERIFIER) private readonly verifier: EnrollmentVerifier) {}
  get database() { return this.sessions.database; }
  issuer(clientId: string) { return `${configuredOrigin()}/api/v1/direct-login/issuer/${clientId}`; }
  private async mutate<T>(scope: DataScope, work: (issuer: IssuerState, reference: ReferenceState, tx: Prisma.TransactionClient) => Promise<T> | T): Promise<T> {
    return scopedTransaction(this.database, scope, async tx => {
      const workspace = await tx.demoSession.findUniqueOrThrow({ where: { id: scope.sessionId } });
      if (workspace.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('Workspace expired');
      const stored = await tx.directLoginWorkspace.findUnique({ where: { sessionId: scope.sessionId } });
      const provider = await tx.referenceProviderWorkspace.findUnique({ where: { sessionId: scope.sessionId } });
      const state = stored ? stored.payload as unknown as IssuerState : newIssuer();
      const reference = provider ? provider.payload as unknown as ReferenceState : emptyProvider();
      reference.enrollments ??= [];
      state.installations = (state.installations??[]).filter(i=>i.expires>Date.now());
      for (const snapshot of state.snapshots) snapshot.origin ??= snapshot.trusted ? 'reference' : 'external';
      // Preserve acknowledgment records authored by the first local state format.
      state.acknowledgments ??= state.acquisitions.filter(a => !a.identityId).map(a => ({referralId:a.referralId,clientId:state.references.find(r=>r.referralId===a.referralId)?.clientId??'',revision:a.tariffRevision,acceptedAt:a.createdAt,rateRial:a.rateRial}));
      state.acquisitions = state.acquisitions.filter(a => a.identityId);
      const now = Date.now();
      state.challenges = state.challenges.filter(c => c.expires > now);
      state.sessions = state.sessions.filter(c => c.expires > now);
      state.access = state.access.filter(c => c.expires > now);
      state.flows = state.flows.filter(c => c.expires > now);
      reference.sessions = reference.sessions.filter(c => c.expires > now);
      reference.transactions = reference.transactions.filter(c => c.transaction.createdAt + 600000 > now);
      const result = await work(state, reference, tx);
      await tx.directLoginWorkspace.upsert({ where: { sessionId: scope.sessionId }, create: { sessionId: scope.sessionId, payload: state as unknown as Prisma.InputJsonValue }, update: { payload: state as unknown as Prisma.InputJsonValue } });
      await tx.referenceProviderWorkspace.upsert({ where: { sessionId: scope.sessionId }, create: { sessionId: scope.sessionId, payload: reference as unknown as Prisma.InputJsonValue }, update: { payload: reference as unknown as Prisma.InputJsonValue } });
      return result;
    });
  }
  assertBrowserMutation(request: WebRequest, surface: 'web' | 'admin' = 'web') {
    const allowed = surface === 'admin' ? [configuredOrigin(), configuredAdminOrigin()] : [configuredOrigin()];
    if (request.headers['sec-fetch-site'] === 'cross-site' || (request.headers.origin && !allowed.includes(request.headers.origin))) throw new ForbiddenException('Unrecognized request origin');
  }
  private cookieName(scope: DataScope, kind: string) { return `tt_${kind}_${sha256(scope.sessionId).slice(0, 12)}`; }
  cookie(scope: DataScope, kind: string, request: WebRequest) {
    const entries = (request.headers.cookie ?? '').split(';').map(p => p.trim()).filter(p => p.startsWith(`${this.cookieName(scope, kind)}=`));
    if (entries.length !== 1) return undefined;
    const value = entries[0]!.slice(this.cookieName(scope, kind).length + 1);
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
  }
  setCookie(scope: DataScope, kind: string, value: string, response: CookieResponse, maxAge = 86400) {
    const item = `${this.cookieName(scope, kind)}=${value}; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${configuredOrigin().startsWith('https:') ? '; Secure' : ''}`;
    const prior = response.getHeader?.('Set-Cookie');
    response.setHeader('Set-Cookie', [...(Array.isArray(prior) ? prior : typeof prior === 'string' ? [prior] : []), item]);
  }
  browser(scope: DataScope, request: WebRequest, response: CookieResponse) {
    const binding = this.cookie(scope, 'browser', request) ?? randomToken();
    this.setCookie(scope, 'browser', binding, response);
    return sha256(binding);
  }
  private identity(state: IssuerState, scope: DataScope, request: WebRequest) {
    const session = this.cookie(scope, 'identity', request);
    const record = session && state.sessions.find(s => s.hash === sha256(session) && s.expires > Date.now());
    return record ? state.identities.find(i => i.id === record.identityId) : undefined;
  }
  private publicIdentity(identity?: { phone: string; profile?: TravelerProfile }) { return identity ? { displayName: identity.profile ? `${identity.profile.givenName} ${identity.profile.familyName}` : 'مسافر', phone: identity.phone, ...(identity.profile ? {profile:identity.profile} : {}) } : null; }
  async requestCode(scope: DataScope, phone: string, purpose: string, browser: string) {
    if (purpose !== 'torob' && (await this.partner(scope, purpose))?.kind !== 'reference') throw new NotFoundException();
    return this.mutate(scope, async (state, reference, tx) => {
      void reference;
      if (purpose !== 'torob' && !await tx.directLoginClient.findFirst({ where: { sessionId: scope.sessionId, providerId: purpose, enabled: true, kind: 'reference' } })) throw new NotFoundException();
      const now = Date.now();
      if (state.challenges.some(c => c.phone === phone && c.purpose === purpose && c.created + 60000 > now)) throw new ConflictException('برای دریافت دوباره کد، یک دقیقه صبر کنید');
      const testCode = localSmsTestCode(configuredOrigin());
      const id = randomToken(), code = testCode ?? String(randomInt(100000, 1000000));
      for (const c of state.challenges) if (c.phone === phone && c.purpose === purpose) c.used = true;
      if (state.challenges.length >= 100) throw new ConflictException('Verification capacity reached');
      state.challenges.push({ id, phone, purpose, codeHash: sha256(`${id}:${code}`), deliveryCode: code, browser, expires: now + 300000, created: now, attempts: 0, used: false, testCode: testCode !== undefined });
      return { id, expiresAt: new Date(now + 300000).toISOString() };
    });
  }
  private publish(state: IssuerState, reference: ReferenceState, providerId: string) {
    const tree = accountTree(providerId, reference.accounts.filter(a => a.providerId === providerId));
    if (!state.snapshots.some(s => s.root === tree.root && s.providerId === providerId && s.origin === 'reference')) state.snapshots.push({ providerId, root: tree.root, at: Date.now(), sequence: ++state.sequence, trusted: true, origin: 'reference' });
    for (const account of reference.accounts.filter(a => a.providerId === providerId)) {
      const root = accountTree(providerId, [account]).root;
      if (!state.snapshots.some(s => s.root === root && s.providerId === providerId && s.origin === 'reference')) state.snapshots.push({ providerId, root, at: Date.now(), sequence: ++state.sequence, trusted: true, origin: 'reference' });
    }
    return tree;
  }
  async verifyCode(scope: DataScope, id: string, code: string, browser: string, purpose: string) {
    if (purpose !== 'torob' && (await this.partner(scope, purpose))?.kind !== 'reference') throw new NotFoundException();
    const result = await this.mutate(scope, async (state, reference, tx) => {
      if (purpose !== 'torob' && !await tx.directLoginClient.findFirst({ where: { sessionId: scope.sessionId, providerId: purpose, enabled: true, kind: 'reference' } })) throw new NotFoundException();
      const challenge = state.challenges.find(c => c.id === id && c.browser === browser && c.purpose === purpose && !c.used && c.expires > Date.now() && c.attempts < 5);
      if (!challenge || (challenge.testCode && !localSmsTestCode(configuredOrigin()))) return { error: true as const };
      challenge.attempts++;
      if (!constantEqual(challenge.codeHash, sha256(`${id}:${code}`))) return { error: true as const };
      challenge.used = true; challenge.deliveryCode = '';
      const token = randomToken(), expires = Date.now() + 86400000;
      if (purpose === 'torob') {
        let identity = state.identities.find(i => i.phone === challenge.phone);
        if (!identity) { identity = { id: randomUUID(), phone: challenge.phone, verifiedAt: new Date().toISOString() }; state.identities.push(identity); }
        state.sessions.push({ hash: sha256(token), identityId: identity.id, expires });
        return { token, identity: this.publicIdentity(identity) };
      }
      let account = reference.accounts.find(a => a.providerId === purpose && a.phone === challenge.phone);
      const created = !account;
      if (!account && reference.accounts.length >= 1000) throw new ConflictException('Provider account capacity reached');
      if (!account) { account = { id: randomUUID(), providerId: purpose, phone: challenge.phone, salt: randomToken(), createdAt: new Date().toISOString(), verifiedAt: new Date().toISOString() }; reference.accounts.push(account); }
      if (created) reference.enrollments.push({ providerId: purpose, accountId: account.id, occurredAt: account.createdAt });
      this.publish(state, reference, purpose);
      if (created) {
        const identity = state.identities.find(i => i.phone === challenge.phone);
        const client = await tx.directLoginClient.findUniqueOrThrow({ where: { sessionId_providerId: { sessionId: scope.sessionId, providerId: purpose } } });
        const pending = identity && state.acquisitions.filter(a => a.providerId === purpose && a.identityId === identity.id && a.status === 'pending');
        const acquisition = pending && pending.find(a => state.references.some(r => r.referralId === a.referralId && r.created <= Date.now() && r.expires > Date.now()));
        if (identity && acquisition) reference.outbox.push({ id: randomUUID(), clientId: client.clientId, referralId: acquisition.referralId, identityId: identity.id, accountId: account.id, created: true, occurredAt: account.createdAt, delivered: false });
        this.reconcile(state, reference);
      }
      reference.sessions.push({ hash: sha256(token), providerId: purpose, accountId: account.id, expires });
      return { token, identity: this.publicIdentity(account) };
    });
    if ('error' in result) throw invalid('کد تأیید صحیح نیست یا منقضی شده است');
    return result;
  }
  async account(scope: DataScope, request: WebRequest) { return this.mutate(scope, state => ({ identity: this.publicIdentity(this.identity(state, scope, request)) })); }
  async saveProfile(scope: DataScope, request: WebRequest, profile: TravelerProfile) {
    return this.mutate(scope, state => {
      const identity=this.identity(state,scope,request);
      if(!identity)throw new UnauthorizedException('ابتدا وارد حساب کاربری شوید');
      if(profile.birthDate>localDateAt(new Date().toISOString(),'Asia/Tehran'))throw invalid('تاریخ تولد نباید در آینده باشد');
      identity.profile=structuredClone(profile);
      return {identity:this.publicIdentity(identity)};
    });
  }
  private async travelContext(tx: Prisma.TransactionClient, scope: DataScope, referralId: string): Promise<TravelContext> {
    const row=await tx.referralEvent.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:referralId}}});
    if(!row)throw invalid();
    const receipt=ReferralReceiptSchema.parse(row.payload), payload=receipt.payload;
    const fixture=await tx.fixtureVersion.findUniqueOrThrow({where:{id:payload.quote.fixtureVersion}});
    const catalog=catalogForIdentity(fixture.id,fixture.catalogRevision);
    if(payload.kind==='hotel') {
      const city=catalog.cities.find(c=>c.id===payload.quote.query.destinationCityId);
      if(!city)throw invalid('اطلاعات مقصد برای تکمیل مشخصات مسافر در دسترس نیست');
      return {international:city.countryCode!=='IR',travelDate:payload.quote.query.checkIn,lastTravelDate:payload.quote.query.checkOut};
    }
    const segments=[...payload.itinerary.outbound.segments,...(payload.itinerary.return?.segments??[])];
    const countries=segments.flatMap(segment=>[segment.originPlaceId,segment.destinationPlaceId]).map(id=>catalog.cities.find(c=>c.id===catalog.places.find(p=>p.id===id)?.cityId)?.countryCode);
    if(countries.some(c=>!c))throw invalid('اطلاعات مسیر برای تکمیل مشخصات مسافر در دسترس نیست');
    const first=segments[0]!,last=segments.at(-1)!;
    return {international:countries.some(c=>c!=='IR'),travelDate:localDateAt(first.departureAt,first.departureTimeZone),lastTravelDate:localDateAt(last.arrivalAt,last.arrivalTimeZone)};
  }
  async logout(scope: DataScope, request: WebRequest) {
    const token = this.cookie(scope, 'identity', request);
    return this.mutate(scope, state => { if (token) { const hash = sha256(token); state.sessions = state.sessions.filter(s => s.hash !== hash); for (const flow of state.flows) if (flow.identitySession === hash) flow.consumed = true; } return { signedOut: true }; });
  }
  private async client(clientId: string) {
    const row = await this.database.directLoginClient.findUnique({ where: { clientId } });
    if (!row || !row.enabled) throw new UnauthorizedException('Client unavailable');
    return row;
  }
  private async clientMutation<T>(client: { sessionId: string; clientId: string; revision: number; secretHash: string }, work: (state: IssuerState, reference: ReferenceState, tx: Prisma.TransactionClient) => Promise<T> | T) {
    return this.mutate(client, async (state, reference, tx) => {
      const live = await tx.directLoginClient.findUniqueOrThrow({ where: { clientId: client.clientId } });
      if (!live.enabled || live.revision !== client.revision || !constantEqual(live.secretHash, client.secretHash)) throw new UnauthorizedException('Client authorization changed');
      return work(state, reference, tx);
    });
  }
  private async credentials(clientId: string, secret: string) {
    const row = await this.client(clientId);
    if (!constantEqual(row.secretHash, sha256(secret))) throw new UnauthorizedException('Invalid client credentials');
    return row;
  }
  async clientStatus(clientId:string,secret:string) { const client=await this.credentials(clientId,secret); return this.clientMutation(client,()=>({active:true})); }
  async partner(scope: DataScope, providerId: string) { return this.database.directLoginClient.findFirst({ where: { sessionId: scope.sessionId, providerId, enabled: true } }); }
  async savePartner(context: SessionContext, input: PartnerInput) {
    if (!catalogForIdentity(context.info.fixtureVersion, context.info.catalogRevision).providerCapabilities.some(p => p.providerId === input.providerId)) throw new NotFoundException();
    const callback = new URL(input.callbackUrl), start = new URL(input.loginStartUrl);
    if (start.origin !== callback.origin || start.search || start.hash || start.username || start.password) throw invalid('Login start and callback must share an origin');
    if (callback.hash || callback.search || callback.username || callback.password || (callback.protocol !== 'https:' && !(callback.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(callback.hostname)))) throw invalid('Callback must be HTTPS or loopback HTTP');
    if (input.kind === 'reference' && (start.href !== `${configuredOrigin()}/api/v1/reference-provider/${input.providerId}/start` || callback.href !== `${configuredOrigin()}/api/v1/reference-provider/${input.providerId}/callback`)) throw invalid('Reference callback must use the registered local route');
    return this.mutate(context.scope, async (state, reference, tx) => {
      void state;
      const old = await tx.directLoginClient.findUnique({ where: { sessionId_providerId: { sessionId: context.sessionId, providerId: input.providerId } } });
      const secret = randomToken(), clientId = old?.clientId ?? randomUUID();
      const partner = await tx.directLoginClient.upsert({ where: { clientId }, create: { ...input, clientId, sessionId: context.sessionId, secretHash: sha256(secret), revision: 1 }, update: { ...input, secretHash: sha256(secret), revision: { increment: 1 } } });
      for (const flow of state.flows) if (flow.request.client_id === clientId) { flow.consumed = true; flow.expires = 0; }
      state.access = state.access.filter(a => a.clientId !== clientId);
      for (const ref of state.references) if (ref.clientId === clientId) ref.expires = 0;
      reference.credentials = reference.credentials.filter(c => c.clientId !== clientId);
      reference.transactions = reference.transactions.filter(c => c.clientId !== clientId);
      if (input.kind === 'reference') { reference.credentials.push({ clientId, secret }); this.publish(state, reference, input.providerId); }
      return { partner: this.publicPartner(partner), clientSecret: secret };
    });
  }
  async installExampleProvider(context:SessionContext,providerId:string,name:string) {
    const site=exampleProviderOrigin();
    const previous=await this.database.directLoginClient.findUnique({where:{sessionId_providerId:{sessionId:context.sessionId,providerId}}});
    const saved=await this.savePartner(context,{providerId,name,callbackUrl:site+'/callback',loginStartUrl:site+'/login',kind:'external',enabled:false,acquisitionRateRial:previous?.acquisitionRateRial===null||previous?.acquisitionRateRial===undefined?null:Number(previous.acquisitionRateRial)});
    const code=randomToken(),clientId=saved.partner.clientId;
    await this.mutate(context.scope,async(state,reference,tx)=>{
      void reference;
      const client=await tx.directLoginClient.findUniqueOrThrow({where:{clientId}});
      if(client.revision!==saved.partner.revision||!constantEqual(client.secretHash,sha256(saved.clientSecret)))throw invalid('Connection changed. Try again.');
      if(state.installations!.length>=20)throw new ConflictException('Installation capacity reached');
      await tx.directLoginClient.update({where:{clientId},data:{loginStartUrl:`${site}/providers/${clientId}/login`}});
      state.installations!.push({hash:sha256(code),clientId,secret:saved.clientSecret,revision:client.revision,origin:site,expires:Date.now()+60000,consumed:false});
    });
    try {
      const response=await fetch(new URL('/internal/registrations',exampleProviderInternalOrigin()),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,code}),redirect:'error',signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error('Installation failed');
      const result=await response.json() as {installed?:boolean;clientId?:string};
      if(!result.installed||result.clientId!==clientId)throw Error('Invalid installation response');
    } catch {throw new ConflictException('Example provider is unavailable. Start its service and connect again.');}
    return this.mutate(context.scope,async(state,reference,tx)=>{
      void reference;
      const client=await tx.directLoginClient.findUniqueOrThrow({where:{clientId}});
      const installation=state.installations!.find(i=>i.clientId===clientId&&i.hash===sha256(code));
      if(!installation?.consumed||installation.expires<=Date.now()||client.revision!==saved.partner.revision||!constantEqual(client.secretHash,sha256(saved.clientSecret)))throw invalid('Connection changed during installation');
      const active=await tx.directLoginClient.update({where:{clientId},data:{enabled:true}});
      return {partner:this.publicPartner(active)};
    });
  }
  async exchangeExampleInstallation(clientId:string,code:string) {
    const client=await this.database.directLoginClient.findUnique({where:{clientId}});
    if(!client)throw invalid();
    return this.mutate(client,async(state,reference,tx)=>{
      void reference;
      const live=await tx.directLoginClient.findUniqueOrThrow({where:{clientId}});
      const installation=state.installations!.find(i=>i.clientId===clientId&&i.hash===sha256(code)&&!i.consumed&&i.expires>Date.now());
      if(!installation||live.revision!==installation.revision||installation.origin!==exampleProviderOrigin()||live.kind!=='external'||live.callbackUrl!==installation.origin+'/callback'||!constantEqual(live.secretHash,sha256(installation.secret)))throw invalid();
      installation.consumed=true;
      return {clientId,revision:live.revision,clientSecret:installation.secret,issuer:this.issuer(clientId),callbackUrl:live.callbackUrl,providerId:live.providerId,providerName:live.name,providerOrigin:installation.origin};
    });
  }
  exampleSiteUrl(client:{clientId:string;kind:string;loginStartUrl:string;callbackUrl:string}) {
    const site=exampleProviderOrigin();
    return client.kind==='external'&&client.loginStartUrl===`${site}/providers/${client.clientId}/login`&&client.callbackUrl===site+'/callback'?`${site}/providers/${client.clientId}`:undefined;
  }
  private publicPartner(row: { providerId: string; name: string; callbackUrl: string; loginStartUrl: string; enabled: boolean; acquisitionRateRial: bigint | null; kind: string; clientId: string; revision: number }) { return { providerId: row.providerId, name: row.name, callbackUrl: row.callbackUrl, loginStartUrl: row.loginStartUrl, enabled: row.enabled, acquisitionRateRial: row.acquisitionRateRial === null ? null : Number(row.acquisitionRateRial), kind: row.kind, clientId: row.clientId, revision: row.revision, issuer: this.issuer(row.clientId), ...(this.exampleSiteUrl(row)?{exampleSiteUrl:this.exampleSiteUrl(row)}:{}) }; }
  async metadata(clientId: string) { await this.client(clientId); return { issuer: this.issuer(clientId), authorization_endpoint: `${configuredOrigin()}/direct-login/begin`, token_endpoint: `${configuredOrigin()}/api/v1/direct-login/token`, jwks_uri: `${this.issuer(clientId)}/jwks`, userinfo_endpoint: `${this.issuer(clientId)}/userinfo`, response_types_supported: ['code'], subject_types_supported: ['pairwise'], id_token_signing_alg_values_supported: ['EdDSA'], token_endpoint_auth_methods_supported: ['client_secret_post'], code_challenge_methods_supported: ['S256'], scopes_supported: ['openid', 'phone', 'traveler'] }; }
  async jwks(clientId: string) { const client = await this.client(clientId); return this.clientMutation(client, state => ({ keys: [{ ...state.publicKey, kid: state.kid, alg: 'EdDSA', use: 'sig' }] })); }
  async choices(context: SessionContext, receipt: ReferralReceipt) {
    const partner = await this.partner(context.scope, receipt.payload.quote.providerId);
    return { providerId: receipt.payload.quote.providerId, providerName: partner?.name ?? 'فروشنده', directLogin: Boolean(partner), referralId: receipt.referralId, callbackUrl: partner ? `/api/v1/direct-login/start/${receipt.referralId}` : null };
  }
  async bindReferral(context: SessionContext, receipt: ReferralReceipt) {
    const client = await this.partner(context.scope, receipt.payload.quote.providerId);
    if (!client) throw new NotFoundException();
    return this.mutate(context.scope, state => {
      let reference = state.references.find(r => r.referralId === receipt.referralId && r.clientId === client.clientId);
      if (!reference && state.references.length >= 2000) throw new ConflictException('Referral capacity reached');
      if (!reference) { reference = { handle: randomToken(), referralId: receipt.referralId, providerId: client.providerId, clientId: client.clientId, integration: client.kind, created: Date.now(), sequence: ++state.sequence, expires: Date.now() + 600000 }; state.references.push(reference); }
      // Reopening retains the original attribution cutoff.
      if (reference.expires < Date.now()) { reference.integration = client.kind; reference.handle = randomToken(); reference.expires = Date.now() + 600000; }
      return { handle: reference.handle, providerId: client.providerId, name: client.name, kind: client.kind, clientId: client.clientId, loginStartUrl: client.loginStartUrl };
    });
  }
  private reference(state: IssuerState, clientId: string, handle: string) { const ref = state.references.find(r => r.handle === handle && r.clientId === clientId && r.expires > Date.now()); if (!ref) throw invalid(); return ref; }
  private sdk(client: { clientId: string; callbackUrl: string }, secret: string) {
    return createProviderSdk({ issuer: this.issuer(client.clientId), clientId: client.clientId, clientSecret: secret, callbackUrl: client.callbackUrl, transport: (url, init) => {
      const parsed = new URL(String(url));
      const internal = process.env.TOROBTICKET_SSO_INTERNAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? '4302'}`;
      return fetch(new URL(parsed.pathname + parsed.search, internal), init);
    } });
  }
  async referenceStart(scope: DataScope, providerId: string, handle: string, request: WebRequest) {
    const client = await this.partner(scope, providerId);
    if (!client || client.kind !== 'reference') throw new NotFoundException();
    const secret = await this.clientMutation(client, (state, reference) => {
      this.reference(state, client.clientId, handle);
      const credential = reference.credentials.find(c => c.clientId === client.clientId);
      if (!credential) throw invalid();
      return credential.secret;
    });
    await this.sdk(client, secret).acceptReferral(handle);
    return this.clientMutation(client, (state, reference) => {
      this.reference(state, client.clientId, handle);
      if (reference.transactions.length >= 100) throw new ConflictException('Provider login capacity reached');
      const started = this.sdk(client, secret).begin(handle), token = randomToken();
      reference.transactions.push({ hash: sha256(token), clientId: client.clientId, transaction: started.transaction, consumed: false });
      void request;
      return { url: started.url, token };
    });
  }
  async authorize(scope: DataScope, input: AuthorizeInput, browser: string, request: WebRequest) {
    const client = await this.client(input.client_id);
    if (client.sessionId !== scope.sessionId || client.callbackUrl !== input.redirect_uri) throw invalid();
    return this.clientMutation(client, (state, reference) => {
      const ref = this.reference(state, client.clientId, input.ref);
      const token = this.cookie(scope, `provider_${client.providerId}`, request);
      const providerSession = token && reference.sessions.find(s => s.hash === sha256(token) && s.providerId === client.providerId && s.expires > Date.now());
      const account = providerSession && reference.accounts.find(a => a.id === providerSession.accountId);
      const tree = accountTree(client.providerId, account ? [account] : []);
      const witnessed = state.snapshots.find(s => s.providerId === client.providerId && s.root === tree.root && s.sequence < ref.sequence && s.at <= ref.created && s.trusted && s.origin === client.kind);
      const flow: Flow = { id: randomToken(), request: input, browser, expires: Date.now() + 600000, status: 'pending', ...(account && witnessed ? { proof: tree.proof(account.id) } : ref.proof ? { proof: ref.proof } : {}) };
      if (state.flows.length >= 100) throw new ConflictException('Sign-in capacity reached');
      state.flows.push(flow);
      return flow.id;
    });
  }
  private ownedFlow(state: IssuerState, id: string, browser: string) { const flow = state.flows.find(f => f.id === id && f.browser === browser && f.expires > Date.now()); if (!flow) throw invalid(); return flow; }
  private existing(state: IssuerState, flow: Flow, phone: string, kind: string) {
    const ref = this.reference(state, flow.request.client_id, flow.request.ref);
    const proof = flow.proof;
    return Boolean(proof && state.snapshots.some(s => s.providerId === ref.providerId && s.root === proof.root && s.sequence < ref.sequence && s.at <= ref.created && s.trusted && s.origin === kind) && verifyAccountProof(ref.providerId, phone, proof));
  }
  async flow(scope: DataScope, id: string, browser: string, request: WebRequest) {
    return this.mutate(scope, async (state,reference,tx) => {
      void reference;
      const flow = this.ownedFlow(state, id, browser), client = await this.client(flow.request.client_id), identity = this.identity(state, scope, request), ref = this.reference(state, client.clientId, flow.request.ref);
      return { id: flow.id, providerId: client.providerId, providerName: client.name, referralId: ref.referralId, identity: this.publicIdentity(identity), existingProof: Boolean(identity && this.existing(state, flow, identity.phone, client.kind)), status: flow.status, expiresAt: new Date(flow.expires).toISOString(), profileRequired:flow.request.scope==='openid phone traveler', travelContext:flow.request.scope==='openid phone traveler'?await this.travelContext(tx,scope,ref.referralId):null };
    });
  }
  async consent(scope: DataScope, id: string, browser: string, request: WebRequest, approved: boolean) {
    return this.mutate(scope, async (state,reference,tx) => {
      void reference;
      const flow = this.ownedFlow(state, id, browser), client = await this.client(flow.request.client_id);
      if (flow.status !== 'pending' || client.sessionId !== scope.sessionId) throw invalid();
      const callback = new URL(client.callbackUrl);
      callback.searchParams.set('state', flow.request.state);
      if (!approved) { flow.status = 'denied'; callback.searchParams.set('error', 'access_denied'); return { redirect: callback.href }; }
      const identity = this.identity(state, scope, request);
      if (!identity) throw new UnauthorizedException('ابتدا وارد حساب کاربری شوید');
      const ref = this.reference(state, client.clientId, flow.request.ref), existing = this.existing(state, flow, identity.phone, client.kind);
      if(flow.request.scope==='openid phone traveler') {
        if(!identity.profile)throw invalid('ابتدا اطلاعات مسافر را کامل کنید');
        try {flow.authorizedProfile=travelerProfileForTrip(identity.profile,await this.travelContext(tx,scope,ref.referralId),localDateAt(new Date().toISOString(),'Asia/Tehran'));}
        catch(error){throw invalid(error instanceof Error?error.message:'اطلاعات مسافر را بررسی کنید');}
      }
      const prior = state.acquisitions.find(a => a.providerId === client.providerId && a.identityId === identity.id && a.integration === client.kind && a.status === 'new');
      const acquisition: Acquisition = { integration: client.kind, id: randomUUID(), providerId: client.providerId, referralId: ref.referralId, identityId: identity.id, accountId: existing ? flow.proof!.accountId : null, status: existing ? 'existing' : prior ? 'repeat' : 'pending', reason: existing ? 'Verified account commitment predates referral' : prior ? 'Customer acquisition already recorded' : 'Attribution accepted before identity release; awaiting account evidence', createdAt: new Date().toISOString(), confirmedAt: existing ? new Date().toISOString() : null, rateRial: !existing && !prior && client.acquisitionRateRial !== null ? Number(client.acquisitionRateRial) : null, tariffRevision: client.revision, evidence: existing ? 'prior-commitment' : 'none' };
      if (!existing && !state.acknowledgments.some(a => a.referralId === ref.referralId && a.clientId === client.clientId && a.revision === client.revision)) throw new ConflictException('Provider attribution acknowledgment required');
      const previous = state.acquisitions.find(a => a.referralId === ref.referralId && a.providerId === client.providerId && a.identityId === identity.id && a.integration === client.kind);
      if (previous) { acquisition.id = previous.id; if (existing && previous.status !== 'new') Object.assign(previous, acquisition); }
      else { if (state.acquisitions.length >= 2000) throw new ConflictException('Acquisition capacity reached'); state.acquisitions.push(acquisition); }
      const code = randomToken();
      flow.status = 'consented'; flow.identityId = identity.id; flow.identitySession = sha256(this.cookie(scope, 'identity', request)!); flow.acquisitionId = acquisition.id; flow.codeHash = sha256(code); flow.codeExpires = Date.now() + 60000;
      callback.searchParams.set('code', code);
      return { redirect: callback.href };
    });
  }
  private subject(state: IssuerState, clientId: string, identityId: string) { return createHmac('sha256', state.subjectSecret).update(JSON.stringify([clientId, identityId])).digest('base64url'); }
  async token(input: { client_id: string; client_secret: string; code: string; redirect_uri: string; code_verifier: string }) {
    const client = await this.credentials(input.client_id, input.client_secret);
    return this.clientMutation(client, async (state, reference, tx) => {
      void reference;
      const live = await tx.directLoginClient.findUniqueOrThrow({ where: { clientId: client.clientId } });
      if (!live.enabled || !constantEqual(live.secretHash, sha256(input.client_secret))) throw invalid();
      const flow = state.flows.find(f => f.request.client_id === client.clientId && f.codeHash === sha256(input.code));
      if (!flow || flow.consumed || flow.status !== 'consented' || (flow.codeExpires ?? 0) <= Date.now() || flow.request.redirect_uri !== input.redirect_uri || !constantEqual(flow.request.code_challenge, pkceChallenge(input.code_verifier)) || !state.sessions.some(s => s.hash === flow.identitySession && s.expires > Date.now())) throw invalid();
      const identity = state.identities.find(i => i.id === flow.identityId), acquisition = state.acquisitions.find(a => a.id === flow.acquisitionId);
      if (!identity || !acquisition) throw invalid();
      flow.consumed = true; flow.status = 'complete';
      const now = Math.floor(Date.now() / 1000), access = randomToken();
      const claims = { iss: this.issuer(client.clientId), aud: client.clientId, sub: this.subject(state, client.clientId, identity.id), iat: now, exp: now + 120, nonce: flow.request.nonce, phone_number: identity.phone, phone_number_verified: true, referral_id: acquisition.referralId, attribution: acquisition.status === 'existing' ? 'existing' : 'pending', ...(flow.authorizedProfile?{traveler_profile:flow.authorizedProfile}:{}) };
      const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: state.kid, typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const signature = sign(null, Buffer.from(`${header}.${body}`), state.privateKey).toString('base64url');
      state.access.push({ hash: sha256(access), clientId: client.clientId, identityId: identity.id, acquisitionId: acquisition.id, identitySession: flow.identitySession!, ...(flow.authorizedProfile?{authorizedProfile:flow.authorizedProfile}:{}), expires: Date.now() + 120000 });
      return { token_type: 'Bearer', expires_in: 120, access_token: access, id_token: `${header}.${body}.${signature}` };
    });
  }
  async userinfo(clientId: string, bearer: string) {
    const client = await this.client(clientId);
    return this.clientMutation(client, async (state, reference, tx) => {
      void reference;
      const live = await tx.directLoginClient.findUniqueOrThrow({ where: { clientId } });
      if (!live.enabled || live.revision !== client.revision) throw new UnauthorizedException();
      const access = state.access.find(a => a.hash === sha256(bearer) && a.clientId === clientId && a.expires > Date.now());
      const acquisition = access && state.acquisitions.find(a => a.id === access.acquisitionId), identity = access && state.identities.find(i => i.id === access.identityId);
      if (!identity || !acquisition || !access || !state.sessions.some(s => s.hash === access.identitySession && s.expires > Date.now())) throw new UnauthorizedException();
      return { sub: this.subject(state, clientId, identity.id), phone_number: identity.phone, phone_number_verified: true, referral_id: acquisition.referralId, ...(access.authorizedProfile?{traveler_profile:access.authorizedProfile}:{}) };
    });
  }
  private reconcile(state: IssuerState, reference: ReferenceState) {
    // The local enrollment witness observes every signup path, independently of
    // whether the provider sends its attributed completion callback.
    for (const acquisition of state.acquisitions.filter(a => a.status === 'pending' && a.identityId && a.integration === 'reference')) {
      const identity = state.identities.find(i => i.id === acquisition.identityId);
      const ref = state.references.find(r => r.referralId === acquisition.referralId && r.providerId === acquisition.providerId);
      const account = identity && reference.accounts.find(a => a.providerId === acquisition.providerId && a.phone === identity.phone);
      const enrollment = account && reference.enrollments.find(e => e.accountId === account.id);
      if (!ref || ref.integration !== 'reference' || !account || !enrollment || Date.parse(enrollment.occurredAt) < ref.created || Date.parse(enrollment.occurredAt) > ref.created + 600000) continue;
      const prior = state.acquisitions.some(a => a.id !== acquisition.id && a.integration === 'reference' && a.status === 'new' && a.providerId === acquisition.providerId && (a.identityId === acquisition.identityId || a.accountId === account.id));
      acquisition.status = prior ? 'repeat' : 'new'; acquisition.accountId = account.id;
      acquisition.reason = prior ? 'Customer acquisition already recorded' : 'Local reference account enrollment independently witnessed';
      acquisition.evidence = 'local-enrollment'; acquisition.confirmedAt = new Date().toISOString();
    }
    for (const event of reference.outbox) {
      if (event.delivered) continue;
      const account = reference.accounts.find(a => a.id === event.accountId);
      if (!account) continue;
      for (const acquisition of state.acquisitions.filter(a => a.referralId === event.referralId && a.identityId === event.identityId && a.integration === 'reference' && a.status === 'pending')) {
        const ref = state.references.find(r => r.referralId === event.referralId && r.clientId === event.clientId);
        if (!ref || ref.integration !== 'reference' || acquisition.providerId !== account.providerId) continue;
        const prior = state.acquisitions.some(a => a.id !== acquisition.id && a.providerId === account.providerId && a.identityId === event.identityId && a.integration === 'reference' && a.status === 'new');
        acquisition.accountId = account.id;
        acquisition.status = prior ? 'repeat' : event.created && Date.parse(account.createdAt) >= ref.created ? 'new' : 'disputed';
        acquisition.reason = prior ? 'Customer acquisition already recorded' : acquisition.status === 'new' ? 'Local reference account enrollment independently witnessed' : 'Existing account requires ownership and pre-referral proof';
        acquisition.evidence = 'local-enrollment'; acquisition.confirmedAt = new Date().toISOString();
      }
      event.delivered = true;
    }
  }
  async referenceCallback(scope: DataScope, providerId: string, request: WebRequest, callback: URL) {
    const client = await this.partner(scope, providerId), token = this.cookie(scope, `flow_${providerId}`, request);
    if (!client || client.kind !== 'reference' || !token) throw invalid();
    const transaction = await this.mutate(scope, (state, reference) => {
      void state;
      const pending = reference.transactions.find(t => t.hash === sha256(token) && t.clientId === client.clientId);
      const credential = reference.credentials.find(c => c.clientId === client.clientId);
      if (!pending || !credential || !constantEqual(callback.searchParams.get('state') ?? '', pending.transaction.state)) throw invalid();
      const callbackHash = sha256(callback.search);
      if (pending.consumed && (pending.callbackHash !== callbackHash || !pending.result)) throw invalid('Login interrupted. Start again from the same provider offer.');
      pending.consumed = true; pending.callbackHash = callbackHash;
      return { ...pending, secret: credential.secret };
    });
    if (transaction.result) return transaction.result;
    if (callback.searchParams.get('error') === 'access_denied') return { denied: true as const };
    const claims = await this.sdk(client, transaction.secret).finish(callback, transaction.transaction);
    return this.mutate(scope, async (state, reference, tx) => {
      const current = await tx.directLoginClient.findUniqueOrThrow({ where: { clientId: client.clientId } });
      if (!current.enabled || !constantEqual(current.secretHash, sha256(transaction.secret))) throw invalid();
      const ref = this.reference(state, client.clientId, transaction.transaction.referral);
      const identity = state.identities.find(i => this.subject(state, client.clientId, i.id) === claims.sub);
      if (!identity || ref.referralId !== claims.referral_id) throw invalid();
      const candidate = reference.accounts.find(a => a.providerId === providerId && a.phone === claims.phone_number);
      // Matching a phone never silently takes over an existing provider account.
      const candidateSession = this.cookie(scope, `provider_${providerId}`, request);
      const owns = candidateSession && reference.sessions.some(s => s.hash === sha256(candidateSession) && s.accountId === candidate?.id && s.expires > Date.now());
      if (candidate && candidate.subject !== claims.sub && !owns) {
        for (const a of state.acquisitions) if (a.referralId === ref.referralId && a.identityId === identity.id && a.status === 'pending') { a.status = 'disputed'; a.reason = 'Sign in to the existing provider account before linking'; }
        return { conflict: true as const, referralId: ref.referralId };
      }
      if (!candidate && reference.accounts.length >= 1000) throw new ConflictException('Provider account capacity reached');
      const created = !candidate;
      const account = candidate ?? { id: randomUUID(), providerId, phone: claims.phone_number, salt: randomToken(), createdAt: new Date().toISOString(), verifiedAt: identity.verifiedAt };
      account.subject = claims.sub;
      if (!candidate) { reference.accounts.push(account); reference.enrollments.push({ providerId, accountId: account.id, occurredAt: account.createdAt }); }
      reference.outbox.push({ id: randomUUID(), clientId: client.clientId, referralId: ref.referralId, identityId: identity.id, accountId: account.id, created: created || Date.parse(account.createdAt) >= ref.created, occurredAt: new Date().toISOString(), delivered: false });
      this.publish(state, reference, providerId);
      this.reconcile(state, reference);
      const sessionToken = randomToken();
      reference.sessions.push({ hash: sha256(sessionToken), providerId, accountId: account.id, expires: Date.now() + 86400000 });
      const pending = reference.transactions.find(t => t.hash === sha256(token));
      const result = { token: sessionToken, referralId: ref.referralId };
      if (pending) pending.result = result;
      return result;
    });
  }
  async callbackRecovery(scope: DataScope, providerId: string, request: WebRequest) {
    return this.mutate(scope, (state, reference) => {
      const token = this.cookie(scope, `flow_${providerId}`, request);
      const pending = token && reference.transactions.find(t => t.hash === sha256(token));
      const ref = pending ? state.references.find(r => r.handle === pending.transaction.referral && r.providerId === providerId) : undefined;
      return ref?.referralId;
    });
  }
  async publishCommitment(clientId: string, secret: string, root: string, attestation: string) {
    const client = await this.credentials(clientId, secret);
    const trusted = await this.verifier.verifyCommitment({ clientId, providerId: client.providerId, root, attestation });
    return this.clientMutation(client, state => {
      const previous = state.snapshots.find(s => s.providerId === client.providerId && s.root === root && s.origin === 'external' && s.trusted);
      if (!previous && (trusted || !state.snapshots.some(s => s.providerId === client.providerId && s.root === root && s.origin === 'external'))) {
        if (state.snapshots.length >= 4000) throw new ConflictException('Commitment capacity reached');
        state.snapshots.push({ providerId: client.providerId, root, at: Date.now(), sequence: ++state.sequence, trusted, origin: 'external' });
      }
      return { accepted: true, verified: previous?.trusted ?? trusted };
    });
  }
  async proveExisting(clientId: string, secret: string, handle: string, proof: CommitmentProof) {
    const client = await this.credentials(clientId, secret);
    return this.clientMutation(client, state => {
      const ref = this.reference(state, clientId, handle);
      if (!state.snapshots.some(s => s.providerId === client.providerId && s.root === proof.root && s.sequence < ref.sequence && s.at <= ref.created && s.trusted && s.origin === client.kind)) throw invalid('A verified commitment predating the referral is required');
      ref.proof = proof;
      return { received: true };
    });
  }
  async reportAccount(clientId: string, secret: string, referralId: string, subject: string, accountId: string, attestation = '') {
    const client = await this.credentials(clientId, secret);
    return this.clientMutation(client, async state => {
      const identity = state.identities.find(i => this.subject(state, clientId, i.id) === subject);
      const acquisition = identity && state.acquisitions.find(a => a.providerId === client.providerId && a.referralId === referralId && a.identityId === identity.id && a.integration === client.kind);
      if (!acquisition) throw invalid();
      if (acquisition.status === 'pending') {
        acquisition.accountId = accountId; acquisition.evidence = 'provider-report'; acquisition.reason = 'Provider reported an account; independent enrollment evidence required';
        const verified = await this.verifier.verifyEnrollment({ clientId, providerId: client.providerId, referralId, subject, accountId, phone: identity!.phone, attestation });
        const ref = state.references.find(r => r.referralId === referralId && r.clientId === clientId);
        if (verified && ref && verified.accountId === accountId && verified.firstAccount && Date.parse(verified.occurredAt) >= ref.created && Date.parse(verified.occurredAt) <= ref.created + 600000) {
          const prior = state.acquisitions.some(a => a.id !== acquisition.id && a.providerId === client.providerId && a.integration === client.kind && a.status === 'new' && (a.identityId === identity!.id || a.accountId === accountId));
          acquisition.status = prior ? 'repeat' : 'new'; acquisition.confirmedAt = new Date().toISOString(); acquisition.evidence = 'verified-enrollment'; acquisition.reason = prior ? 'Customer acquisition already recorded' : 'Independent verifier confirmed first account enrollment';
        }
      }
      return { status: acquisition.status };
    });
  }
  private offerLabel(receipt: ReferralReceipt) {
    if (receipt.payload.kind !== 'transport') return 'اقامت انتخاب‌شده';
    const payload = receipt.payload, catalog = catalogForIdentity('showcase-v3', 'catalog-v3');
    const place = (id: string) => { const item = catalog.places.find(p => p.id === id); return catalog.cities.find(city => city.id === item?.cityId)?.name ?? 'مقصد سفر'; };
    return `${place(payload.itinerary.originPlaceId)} ← ${place(payload.itinerary.destinationPlaceId)}`;
  }
  async referencePage(scope: DataScope, providerId: string, request: WebRequest, receipt?: ReferralReceipt) {
    const client = await this.partner(scope, providerId);
    if (!client || client.kind !== 'reference' || (receipt && receipt.payload.quote.providerId !== providerId)) throw new NotFoundException();
    return this.clientMutation(client, (state, reference) => {
      const token = this.cookie(scope, `provider_${providerId}`, request), session = token && reference.sessions.find(s => s.hash === sha256(token) && s.providerId === providerId && s.expires > Date.now());
      const account = session && reference.accounts.find(a => a.id === session.accountId);
      const acquisition = receipt && state.acquisitions.filter(a => a.referralId === receipt.referralId).at(-1);
      return { providerId, providerName: client.name, account: this.publicIdentity(account || undefined), referralId: receipt?.referralId ?? null, receipt: receipt ?? null, offer: receipt ? receipt.payload.kind === 'transport' ? this.offerLabel(receipt) : 'اقامت انتخاب‌شده' : null, status: acquisition?.status ?? null, continueUrl: receipt ? `/api/v1/direct-login/start/${receipt.referralId}` : null };
    });
  }
  async referenceLogout(scope: DataScope, providerId: string, request: WebRequest) { return this.mutate(scope, (state, reference) => { void state; const token = this.cookie(scope, `provider_${providerId}`, request); if (token) reference.sessions = reference.sessions.filter(s => s.hash !== sha256(token)); return { signedOut: true }; }); }
  async externalAcknowledgment(clientId: string, secret: string, handle: string) {
    const client = await this.credentials(clientId, secret);
    return this.clientMutation(client, state => {
      const ref = this.reference(state, clientId, handle);
      if (!state.acknowledgments.some(a => a.referralId === ref.referralId && a.clientId === clientId && a.revision === client.revision)) {
        if (state.acknowledgments.length >= 4000) throw new ConflictException('Acknowledgment capacity reached');
        state.acknowledgments.push({ referralId: ref.referralId, clientId, revision: client.revision, acceptedAt: new Date().toISOString(), rateRial: client.acquisitionRateRial === null ? null : Number(client.acquisitionRateRial) });
      }
      return { accepted: true, referralId: ref.referralId, tariffRevision: client.revision, rateRial: client.acquisitionRateRial === null ? null : Number(client.acquisitionRateRial) };
    });
  }
  async admin(scope: DataScope) {
    return this.mutate(scope, async (state, reference, tx) => {
      this.reconcile(state, reference);
      const partners = await tx.directLoginClient.findMany({ where: { sessionId: scope.sessionId } });
      const acquisitions = state.acquisitions.filter(a => a.identityId).map(({ identityId, integration, ...row }) => { void identityId; void integration; return row; }).reverse();
      const confirmed = acquisitions.filter(a => a.status === 'new');
      return { webOrigin: configuredOrigin(), partners: partners.map(p => this.publicPartner(p)), acquisitions, messages: state.challenges.filter(c => !c.used && c.attempts < 5 && c.expires > Date.now()).map(c => ({ id: c.id, destination: c.phone, code: c.deliveryCode, purpose: c.purpose === 'torob' ? 'TorobTicket sign-in' : `Provider sign-in · ${c.purpose}`, expiresAt: new Date(c.expires).toISOString() })), totals: { newAccounts: confirmed.length, existingAccounts: acquisitions.filter(a => a.status === 'existing').length, pending: acquisitions.filter(a => a.status === 'pending' || a.status === 'disputed').length, amountRial: confirmed.reduce((sum, a) => sum + BigInt(a.rateRial ?? 0), 0n).toString(), unpriced: confirmed.filter(a => a.rateRial === null).length } };
    });
  }
}
