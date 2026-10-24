import { HttpException, Injectable, Inject, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ApiErrorCode, CreateDemoSessionInput } from '@torob-ticket/contracts';
import { createPrisma, checkDatabaseReady, RepositoryError, SessionRepository, sessionInfo, type PrismaClient, type SessionRecord } from '@torob-ticket/data-access';
import { FrozenDemoClock, SystemRealClock } from '../common/clocks';
import type { CookieResponse, SessionContext, SessionRequest } from './session-context';
export const SESSION_COOKIE = 'torob_demo';
export function sessionError(code: ApiErrorCode, status = 401) {
  return new HttpException({ code, fieldPaths: [], retryable: false, requestId: randomUUID() }, status);
}
export function repositoryHttpError(error: unknown): never {
  if (error instanceof RepositoryError) throw sessionError(error.code, error.code === 'NOT_FOUND' ? 404 : error.code === 'SESSION_EXPIRED' ? 401 : 409);
  throw error;
}
@Injectable()
export class SessionService implements OnApplicationBootstrap, OnModuleDestroy {
  private db?: PrismaClient;
  private reconciled = false;
  private initializing?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private readonly controllers = new Map<string, Set<AbortController>>();
  constructor(@Inject(SystemRealClock) readonly realClock: SystemRealClock) {}
  get database(): PrismaClient {
    if (!this.db) this.db = createPrisma(process.env.DATABASE_URL ?? '');
    return this.db;
  }
  get repository() { return new SessionRepository(this.database); }
  async onApplicationBootstrap() {
    await this.ensureReady().catch(() => { /* Liveness stays available; readiness reports storage failure. */ });
    this.timer = setInterval(() => { void this.maintenance().catch(() => { /* Readiness probes expose storage outages. */ }); }, 60000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    for (const id of this.controllers.keys()) this.cancelSession(id);
    await this.initializing?.catch(() => undefined);
    await this.db?.$disconnect();
  }
  async ensureReady() {
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      await checkDatabaseReady(this.database);
      if (!this.reconciled) {
        await this.cleanup();
        // T09 consumes persisted snapshots; update their terminal state together.
        const runs = await this.database.searchRun.findMany({ where: { status: 'collecting' } });
        for (const run of runs) {
          await this.database.$transaction(async tx => {
            const updated = await tx.searchRun.updateMany({ where: { sessionId: run.sessionId, id: run.id, status: 'collecting' }, data: { status: 'interrupted', snapshot: { ...(typeof run.snapshot === 'object' && run.snapshot !== null && !Array.isArray(run.snapshot) ? run.snapshot : {}), status: 'interrupted' }, updatedAt: this.realClock.now() } });
            if (!updated.count) return;
            const last = await tx.searchEventRecord.aggregate({ where: { sessionId: run.sessionId, searchId: run.id }, _max: { sequence: true } });
            await tx.searchEventRecord.create({ data: { sessionId: run.sessionId, searchId: run.id, sequence: (last._max.sequence ?? 0) + 1, payload: { searchId: run.id, clientGeneration: run.clientGeneration, sequence: (last._max.sequence ?? 0) + 1, type: 'terminal', payload: { ...(typeof run.snapshot === 'object' && run.snapshot !== null && !Array.isArray(run.snapshot) ? run.snapshot : {}), status: 'interrupted' } }, createdAt: this.realClock.now() } });
          });
        }
        this.reconciled = true;
      }
    })();
    try { await this.initializing; } finally { this.initializing = undefined; }
  }
  async maintenance() { await this.ensureReady(); await this.cleanup(); }
  private async cleanup() { for (const id of await this.repository.cleanup(this.realClock.now())) this.cancelSession(id); }
  /** Every active search registers its controller and releases it on completion. */
  registerController(context: SessionContext, controller: AbortController): () => void {
    const set = this.controllers.get(context.sessionId) ?? new Set<AbortController>();
    set.add(controller); this.controllers.set(context.sessionId, set);
    return () => { set.delete(controller); if (!set.size) this.controllers.delete(context.sessionId); };
  }
  private cancelSession(id: string) {
    for (const controller of this.controllers.get(id) ?? []) controller.abort();
    this.controllers.delete(id);
  }
  private context(row: SessionRecord): SessionContext {
    const info = sessionInfo(row);
    return Object.freeze({ sessionId: row.id, scope: Object.freeze({ sessionId: row.id }), info, demoClock: new FrozenDemoClock(info.anchorInstant) });
  }
  private credential(request: SessionRequest, response: CookieResponse): string | undefined {
    const matches = (request.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${SESSION_COOKIE}=`));
    if (matches.length > 1) { this.clearCookie(response); throw sessionError('SESSION_EXPIRED'); }
    const value = matches[0]?.slice(SESSION_COOKIE.length + 1);
    if (value !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(value)) { this.clearCookie(response); throw sessionError('SESSION_EXPIRED'); }
    return value;
  }
  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private clearCookie(response: CookieResponse) { response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`); }
  private cookie(response: CookieResponse, token: string, secure: boolean) {
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=86400${secure ? '; Secure' : ''}`);
  }
  assertNoSessionSelector(request: SessionRequest) {
    if (request.query && 'sessionId' in request.query || request.body && typeof request.body === 'object' && 'sessionId' in request.body) throw sessionError('INVALID_QUERY', 400);
  }
  async authenticate(request: SessionRequest, response: CookieResponse): Promise<SessionContext> {
    this.assertNoSessionSelector(request);
    const token = this.credential(request, response);
    if (!token) throw sessionError('SESSION_EXPIRED');
    try {
      // Failed bootstrap must recover/reconcile before any resumed or guarded work.
      if (!this.reconciled) await this.ensureReady();
      const context = this.context(await this.repository.resolveAndTouch(this.hash(token), this.realClock.now()));
      this.cookie(response, token, !!request.secure);
      return context;
    } catch (error) { if (error instanceof RepositoryError && error.code === 'SESSION_EXPIRED') this.clearCookie(response); return repositoryHttpError(error); }
  }
  async createOrResume(input: CreateDemoSessionInput, request: SessionRequest, response: CookieResponse) {
    this.assertNoSessionSelector(request);
    if (this.credential(request, response)) {
      const context = await this.authenticate(request, response);
      if (input.seed !== undefined && input.seed !== context.info.seed || input.anchorInstant !== undefined && input.anchorInstant !== context.info.anchorInstant || input.scenario !== undefined && input.scenario !== context.info.scenario) throw sessionError('INVALID_QUERY', 409);
      return context.info;
    }
    await this.ensureReady();
    const token = randomBytes(32).toString('base64url');
    const row = await this.repository.create(this.hash(token), input, this.realClock.now());
    this.cookie(response, token, !!request.secure);
    return sessionInfo(row);
  }
  async reset(context: SessionContext, input: CreateDemoSessionInput, request: SessionRequest, response: CookieResponse) {
    const token = randomBytes(32).toString('base64url');
    try {
      // A new internal ID fences stale async work from the replacement sandbox.
      const row = await this.repository.reset(context.scope, this.hash(token), { seed: input.seed ?? context.info.seed, anchorInstant: input.anchorInstant ?? context.info.anchorInstant, scenario: input.scenario ?? context.info.scenario }, this.realClock.now());
      this.cancelSession(context.sessionId);
      this.cookie(response, token, !!request.secure);
      return sessionInfo(row);
    } catch (error) { return repositoryHttpError(error); }
  }
}
