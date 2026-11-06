import {appendTrafficVisitorCookie,mintTrafficVisitor,trafficVisitorCookie,verifyTrafficVisitor} from './traffic-visitor';
import { HttpException, Injectable, Inject, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ApiErrorCode, CreateDemoSessionInput } from '@torob-ticket/contracts';
import { createPrisma, checkDatabaseReady, RepositoryError, scopedTransaction, SearchRepository, SessionRepository, sessionInfo, type PrismaClient, type SessionResetOptions, type SessionRecord } from '@torob-ticket/data-access';
import { fixtureIdentity } from '@torob-ticket/fixtures';
import { FrozenDemoClock, SystemRealClock } from '../common/clocks';
import type { CookieResponse, SessionContext, SessionRequest } from './session-context';
export const SESSION_COOKIE = 'torob_demo';
export function sessionError(code: ApiErrorCode, status = 401) {
  return new HttpException({ code, fieldPaths: [], retryable: false, requestId: randomUUID() }, status);
}
export function repositoryHttpError(error: unknown): never {
  if (error instanceof RepositoryError && error.code === 'IDENTITY_REQUIRED') throw sessionError(error.code,403);
  if (error instanceof RepositoryError && error.code === 'SAVED_SEARCH_LIMIT') throw sessionError(error.code,429);
  if (error instanceof RepositoryError) throw error.code === 'SEARCH_LIMIT' ? new HttpException({ code: error.code, fieldPaths: [], retryable: true, requestId: randomUUID() }, 429) : sessionError(error.code, error.code === 'NOT_FOUND' ? 404 : error.code === 'SESSION_EXPIRED' ? 401 : 409);
  throw error;
}
@Injectable()
export class SessionService implements OnApplicationBootstrap, OnModuleDestroy {
  private db?: PrismaClient;
  private reconciled = false;
  private recoveryReady = false;
  private initializing?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private readonly workspaceInitializers = new Set<(context: SessionContext) => Promise<void>>();
  private readonly recoveries = new Set<() => Promise<void>>();
  private readonly pendingWork = new Set<Promise<void>>();
  private readonly controllers = new Map<string, Set<AbortController>>();
  constructor(@Inject(SystemRealClock) readonly realClock: SystemRealClock) {}
  get database(): PrismaClient {
    if (!this.db) this.db = createPrisma(process.env.DATABASE_URL ?? '');
    return this.db;
  }
  get repository() { return new SessionRepository(this.database, fixtureIdentity); }
  async onApplicationBootstrap() {
    await this.ensureReady().catch(() => { /* Liveness stays available; readiness reports storage failure. */ });
    this.timer = setInterval(() => { void this.maintenance().catch(() => { /* Readiness probes expose storage outages. */ }); }, 60000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    for (const id of this.controllers.keys()) this.cancelSession(id, 'shutdown');
    await Promise.allSettled([...this.pendingWork]);
    await this.initializing?.catch(() => undefined);
    await this.db?.$disconnect();
  }
  async ensureReady() {
    if (this.initializing) return this.initializing;
    this.recoveryReady = false;
    this.initializing = (async () => {
      await checkDatabaseReady(this.database, fixtureIdentity);
      if (!this.reconciled) {
        await this.cleanup();
        await new SearchRepository(this.database).interruptUnfinished(this.realClock.now());
        this.reconciled = true;
      }
      for (const recovery of this.recoveries) await recovery();
      this.recoveryReady = true;
    })();
    try { await this.initializing; } finally { this.initializing = undefined; }
  }
  async maintenance() { await this.ensureReady(); await this.cleanup(); }
  private async cleanup() { for (const id of await this.repository.cleanup(this.realClock.now())) this.cancelSession(id); }
  registerWorkspaceInitializer(initialize: (context: SessionContext) => Promise<void>): () => void {
    this.workspaceInitializers.add(initialize); return () => { this.workspaceInitializers.delete(initialize); };
  }
  private async initializeWorkspace(context: SessionContext) {
    for (const initialize of this.workspaceInitializers) await initialize(context);
  }
  registerRecovery(recovery: () => Promise<void>): () => void {
    this.recoveries.add(recovery);
    this.recoveryReady = false;
    return () => { this.recoveries.delete(recovery); };
  }
  /** Every active search registers its controller and releases it on completion. */
  registerController(context: SessionContext, controller: AbortController, done?: Promise<void>): () => void {
    if (done) this.pendingWork.add(done);
    const set = this.controllers.get(context.sessionId) ?? new Set<AbortController>();
    set.add(controller); this.controllers.set(context.sessionId, set);
    return () => { if (done) this.pendingWork.delete(done); set.delete(controller); if (!set.size) this.controllers.delete(context.sessionId); };
  }
  /** A committed scoped configuration revision fences currently registered work. */
  cancelCurrentWork(context: SessionContext, reason = 'configuration-changed') {
    this.cancelSession(context.sessionId, reason);
  }
  private cancelSession(id: string, reason?: string) {
    for (const controller of this.controllers.get(id) ?? []) controller.abort(reason);
    this.controllers.delete(id);
  }
  private context(row: SessionRecord, request?:SessionRequest): SessionContext {
    const info = sessionInfo(row);
    return Object.freeze({ sessionId: row.id, visitorId:verifyTrafficVisitor(request?.headers.cookie,row.id,row.trafficVisitorSecret??undefined), scope: Object.freeze({ sessionId: row.id }), info, demoClock: new FrozenDemoClock(info.anchorInstant) });
  }
  private credential(request: SessionRequest): string | undefined {
    const matches = (request.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${SESSION_COOKIE}=`));
    if (matches.length > 1) { throw sessionError('SESSION_EXPIRED'); }
    const value = matches[0]?.slice(SESSION_COOKIE.length + 1);
    if (value !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(value)) { throw sessionError('SESSION_EXPIRED'); }
    return value;
  }
  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  /** Browser-session persistence avoids a fixed client deadline; PostgreSQL enforces sliding 24h inactivity. */
  private cookie(response: CookieResponse, token: string, secure: boolean, visitorCookie?:string) {
    const auth=`${SESSION_COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
    response.setHeader('Set-Cookie', visitorCookie?[auth,visitorCookie]:auth);
  }
  assertNoSessionSelector(request: SessionRequest) {
    if (request.query && 'sessionId' in request.query || request.body && typeof request.body === 'object' && 'sessionId' in request.body) throw sessionError('INVALID_QUERY', 400);
  }
  async authenticate(request: SessionRequest, _response: CookieResponse): Promise<SessionContext> {
    void _response; // Guard callers retain the response seam; ordinary authentication intentionally never writes it.
    this.assertNoSessionSelector(request);
    const token = this.credential(request);
    if (!token) throw sessionError('SESSION_EXPIRED');
    try {
      // Failed bootstrap must recover/reconcile before any resumed or guarded work.
      if (!this.recoveryReady) await this.ensureReady();
      // Never echo or clear credentials here: this response may arrive after an explicit reset rotated them.
      const context = this.context(await this.repository.resolveAndTouch(this.hash(token), this.realClock.now()),request);
      return context;
    } catch (error) { return repositoryHttpError(error); }
  }
  /** Only explicit bootstrap may mint a visitor; ordinary authenticated responses remain cookie-write free. */
  private async bootstrapVisitor(context:Pick<SessionContext,'sessionId'|'scope'|'visitorId'>,request:SessionRequest){
    if(context.visitorId)return {visitorId:context.visitorId};
    const secret=await scopedTransaction(this.database,context.scope,async tx=>{
      const row=await tx.demoSession.findUniqueOrThrow({where:{id:context.sessionId}});
      if(row.trafficVisitorSecret)return row.trafficVisitorSecret;
      const value=randomBytes(32).toString('base64url');
      await tx.demoSession.update({where:{id:context.sessionId},data:{trafficVisitorSecret:value}});return value;
    });
    const existing=verifyTrafficVisitor(request.headers.cookie,context.sessionId,secret);
    if(existing)return {visitorId:existing};
    const next=mintTrafficVisitor(context.sessionId,secret);
    return {visitorId:next.visitorId,cookie:trafficVisitorCookie(context.sessionId,next.value,!!request.secure)};
  }
  async current(context:SessionContext,request:SessionRequest,response:CookieResponse){
    try{const visitor=await this.bootstrapVisitor(context,request);if(visitor.cookie)appendTrafficVisitorCookie(response,visitor.cookie);return context.info;}catch(error){return repositoryHttpError(error);}
  }
  private expiredCredential(error:unknown){
    const body=error instanceof HttpException?error.getResponse():undefined;
    return error instanceof HttpException&&error.getStatus()===401&&!!body&&typeof body==='object'&&'code' in body&&body.code==='SESSION_EXPIRED';
  }
  async createOrResume(input: CreateDemoSessionInput, request: SessionRequest, response: CookieResponse) {
    this.assertNoSessionSelector(request);
    let hasCredential=false;
    try{hasCredential=Boolean(this.credential(request));}catch(error){if(!this.expiredCredential(error))throw error;}
    if (hasCredential) {
      let context:SessionContext|undefined;
      try{context=await this.authenticate(request,response);}
      catch(error){
        if(!this.expiredCredential(error))throw error;
        // Only an explicit bootstrap may replace an expired credential. Ordinary responses never write it.
      }
      if(context){
        if (input.seed !== undefined && input.seed !== context.info.seed || input.anchorInstant !== undefined && Date.parse(input.anchorInstant) !== Date.parse(context.info.anchorInstant) || input.scenario !== undefined && input.scenario !== context.info.scenario) throw sessionError('INVALID_QUERY', 409);
        const visitor=await this.bootstrapVisitor(context,request);
        if(visitor.cookie)appendTrafficVisitorCookie(response,visitor.cookie);
        await this.initializeWorkspace(context);
        return context.info;
      }
    }
    await this.ensureReady();
    const token = randomBytes(32).toString('base64url');
    const row = await this.repository.create(this.hash(token), input, this.realClock.now());
    const visitor=await this.bootstrapVisitor({sessionId:row.id,scope:{sessionId:row.id}},request);
    this.cookie(response, token, !!request.secure,visitor.cookie);
    await this.initializeWorkspace(this.context(row, request));
    return sessionInfo(row);
  }
  async reset(context: SessionContext, input: CreateDemoSessionInput, request: SessionRequest, response: CookieResponse, options?:SessionResetOptions) {
    const token = randomBytes(32).toString('base64url');
    try {
      // A new internal ID fences stale async work from the replacement sandbox.
      const row = await this.repository.reset(context.scope, this.hash(token), { seed: input.seed ?? context.info.seed, anchorInstant: input.anchorInstant ?? context.info.anchorInstant, scenario: input.scenario ?? context.info.scenario }, this.realClock.now(), options);
      this.cancelSession(context.sessionId);
      const visitor=await this.bootstrapVisitor({sessionId:row.id,scope:{sessionId:row.id}},request);
      this.cookie(response, token, !!request.secure,visitor.cookie);
      await this.initializeWorkspace(this.context(row, request));
      return sessionInfo(row);
    } catch (error) { return repositoryHttpError(error); }
  }
}
