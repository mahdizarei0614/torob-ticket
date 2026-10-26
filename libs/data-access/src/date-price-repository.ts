import {assertSearchAdmission} from './admission';
import { randomUUID } from 'node:crypto';
import { DatePriceQuerySchema, DatePriceSnapshotSchema, SearchSnapshotSchema, type DatePriceQuery, type DatePriceSnapshot, type Coverage, type QuoteSnapshot } from '@torob-ticket/contracts';
import { canonicalTransportQuery, datePriceIdentity, type QueryIdentity } from '@torob-ticket/domain';
import type { Prisma, PrismaClient } from './generated/client';
import { readProviderContext, type ProviderContextSnapshot } from './search-repository';
import { RepositoryError, scopedTransaction, type DataScope } from './scope';
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export interface DatePricePayload {
  kind: 'date-price-evidence'; evidenceSearchId: string; snapshot: DatePriceSnapshot;
  frozen: ProviderContextSnapshot; identity: QueryIdentity; coverageByDate: Record<string, Coverage>;
  sequence: number; completedAt?: string;
  providerEvidence?: Record<string, { status: string; errorCode?: string; dates: { date: string; status: string; errorCode?: string }[] }>;
}
export interface DatePriceProjectionInput {
  payload: DatePricePayload;
  offers: { id: string; payload: Prisma.JsonValue; createdAt: Date }[];
  quotes: QuoteSnapshot[];
}
export interface DatePriceProjectionResult {
  snapshot: DatePriceSnapshot; quotes: { offerId: string; quote: QuoteSnapshot }[]; audit: Record<string, unknown>;
}
/** Same-ID SearchRun is an internal evidence parent, never a public selected-date run. */
export class DatePriceRepository {
  constructor(private readonly db: PrismaClient) {}
  admit(scope: DataScope, input: DatePriceQuery, now: Date, revisions: { sourceRevisions: Record<string, string>; policyRevisions: Record<string, string> }) {
    return scopedTransaction(this.db, scope, async tx => {
      const session = await tx.demoSession.findUniqueOrThrow({ where: { id: scope.sessionId } });
      const frozen = await readProviderContext(tx, scope, session);
      const identity: QueryIdentity = { fixtureVersion: frozen.info.fixtureVersion, catalogRevision: frozen.info.catalogRevision, seed: frozen.info.seed, anchorInstant: frozen.info.anchorInstant, scenario: frozen.info.scenario, scenarioRevision: frozen.info.scenarioRevision, mappingRevision: frozen.info.mappingRevision, providerOverrides: Object.fromEntries(frozen.overrides.map(row => [row.providerId, row.payload])), ...revisions };
      const queryKey = datePriceIdentity(input, identity);
      const prior = await tx.datePriceRun.findMany({ where: { sessionId: scope.sessionId, queryKey }, orderBy: { createdAt: 'desc' } });
      for (const row of prior) {
        const payload = row.payload as unknown as DatePricePayload;
        const ageMs = payload.completedAt ? now.getTime() - Date.parse(payload.completedAt) : undefined;
        const retryableFailure = payload.snapshot.cells.some(cell => cell.status === 'unavailable' && cell.retryable);
        const fresh = !retryableFailure && payload.snapshot.status === 'complete' && ageMs !== undefined && ageMs >= 0 && ageMs < 60000;
        if (payload.snapshot.status === 'checking' || fresh) return { id: row.id, payload, created: false };
      }
      await assertSearchAdmission(tx,scope);
      const request = canonicalDateView(input);
      const id = randomUUID();
      const snapshot: DatePriceSnapshot = { datePriceId: id, clientGeneration: request.clientGeneration, query: request, cells: request.dates.map(date => ({ date, status: 'checking' })), status: 'checking', pollCursor: '0', observedAt: now.toISOString() };
      const parent = SearchSnapshotSchema.parse({ searchId: id, query: request.query, clientGeneration: request.clientGeneration, status: 'collecting', groups: [], providerStatuses: [], coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: false }, observedAt: now.toISOString() });
      await tx.searchRun.create({ data: { sessionId: scope.sessionId, id, query: json(request.query), clientGeneration: request.clientGeneration, status: 'collecting', snapshot: json(parent), mappingRevision: session.mappingRevision, fixtureVersion: session.fixtureVersion, createdAt: now, updatedAt: now } });
      const payload: DatePricePayload = { kind: 'date-price-evidence', evidenceSearchId: id, snapshot, frozen, identity, coverageByDate: {}, sequence: 0 };
      await tx.datePriceRun.create({ data: { sessionId: scope.sessionId, id, queryKey, payload: json(payload), createdAt: now } });
      await tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind: 'date-price-context', payload: json({ datePriceId: id, identity, frozen }), createdAt: now } });
      return { id, payload, created: true };
    });
  }
  read(scope: DataScope, id: string) {
    return scopedTransaction(this.db, scope, async tx => {
      const row = await tx.datePriceRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
      if (!row) throw new RepositoryError('NOT_FOUND');
      return row.payload as unknown as DatePricePayload;
    });
  }
  project(scope: DataScope, id: string, now: Date, update: (payload: DatePricePayload) => void, build: (input: DatePriceProjectionInput) => DatePriceProjectionResult) {
    return scopedTransaction(this.db, scope, async tx => {
      const row = await tx.datePriceRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
      const parent = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
      if (!row || !parent) throw new RepositoryError('NOT_FOUND');
      const payload = row.payload as unknown as DatePricePayload;
      if (payload.evidenceSearchId !== id) throw new RepositoryError('INVALID_QUERY');
      if (payload.snapshot.status !== 'checking') return payload;
      if (parent.status !== 'collecting') return this.interrupt(tx, scope, id, payload, now);
      update(payload);
      const offers = await tx.offerSnapshot.findMany({ where: { sessionId: scope.sessionId, searchId: id } });
      const quotes = await tx.quote.findMany({ where: { sessionId: scope.sessionId, offer: { searchId: id } } });
      const result = build({ payload, offers, quotes: quotes.map(row => row.payload as unknown as QuoteSnapshot) });
      payload.sequence++;
      payload.snapshot = DatePriceSnapshotSchema.parse({ ...result.snapshot, pollCursor: String(payload.sequence) });
      for (const item of result.quotes) await tx.quote.upsert({ where: { sessionId_id_version: { sessionId: scope.sessionId, id: item.quote.quoteId, version: item.quote.version } }, create: { sessionId: scope.sessionId, id: item.quote.quoteId, version: item.quote.version, offerId: item.offerId, payload: json(item.quote), observedAt: new Date(item.quote.observedAt), expiresAt: new Date(item.quote.expiresAt) }, update: {} });
      for (const [providerId, evidence] of Object.entries(payload.providerEvidence ?? {})) await tx.providerRun.upsert({ where: { sessionId_searchId_providerId: { sessionId: scope.sessionId, searchId: id, providerId } }, create: { sessionId: scope.sessionId, searchId: id, providerId, id: randomUUID(), status: evidence.status, payload: json(evidence) }, update: { status: evidence.status, payload: json(evidence) } });
      await tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind: 'date-price-projection', payload: json({ datePriceId: id, snapshot: payload.snapshot, ...result.audit }), createdAt: now } });
      if (payload.snapshot.status !== 'checking') {
        if (payload.snapshot.status === 'complete') payload.completedAt = now.toISOString();
        await tx.searchRun.update({ where: { sessionId_id: { sessionId: scope.sessionId, id } }, data: { status: payload.snapshot.status, snapshot: json({ ...SearchSnapshotSchema.parse(parent.snapshot), status: payload.snapshot.status }), updatedAt: now } });
      }
      await tx.datePriceRun.update({ where: { sessionId_id: { sessionId: scope.sessionId, id } }, data: { payload: json(payload) } });
      return payload;
    });
  }
  /** Called under the same session lock as a configuration revision. */
  async invalidateInTransaction(tx: Prisma.TransactionClient, scope: DataScope, now: Date) {
    const rows = await tx.datePriceRun.findMany({ where: { sessionId: scope.sessionId } });
    const ids: string[] = [];
    for (const row of rows) {
      const payload = row.payload as unknown as DatePricePayload;
      if (payload.kind === 'date-price-evidence' && payload.snapshot.status === 'checking') { await this.interrupt(tx, scope, row.id, payload, now); ids.push(row.id); }
    }
    return ids;
  }
  private async interrupt(tx: Prisma.TransactionClient, scope: DataScope, id: string, payload: DatePricePayload, now: Date) {
    payload.sequence++;
    payload.snapshot = DatePriceSnapshotSchema.parse({ ...payload.snapshot, status: 'interrupted', pollCursor: String(payload.sequence), observedAt: now.toISOString(), cells: payload.snapshot.cells.map(cell => {
      if (cell.status === 'outside-coverage' || cell.status === 'invalid-date-pair') return cell;
      const prior = 'coverage' in cell ? cell.coverage : payload.coverageByDate[cell.date];
      const coverage = prior ? { ...prior, failedProviderIds: [...new Set([...prior.failedProviderIds, ...prior.pendingProviderIds])], pendingProviderIds: [], complete: true } : { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: true };
      return cell.status === 'priced' ? { ...cell, coverage } : { date: cell.date, status: 'unavailable', reason: 'interrupted', retryable: true, coverage };
    }) });
    await tx.datePriceRun.update({ where: { sessionId_id: { sessionId: scope.sessionId, id } }, data: { payload: json(payload) } });
    await tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind: 'date-price-interrupted', payload: json({ datePriceId: id, snapshot: payload.snapshot }), createdAt: now } });
    return payload;
  }
  /** Composes after the authoritative SearchRun restart/storage interruption. */
  async reconcileInterrupted() {
    const rows = await this.db.datePriceRun.findMany();
    for (const row of rows) {
      const payload = row.payload as unknown as DatePricePayload;
      if (payload.kind !== 'date-price-evidence' || payload.snapshot.status !== 'checking') continue;
      try { await scopedTransaction(this.db, { sessionId: row.sessionId }, async tx => {
        const current = await tx.datePriceRun.findUnique({ where: { sessionId_id: { sessionId: row.sessionId, id: row.id } } });
        const parent = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: row.sessionId, id: row.id } } });
        if (current && parent && parent.status !== 'collecting') {
          const latest = current.payload as unknown as DatePricePayload;
          if (latest.snapshot.status === 'checking') await this.interrupt(tx, { sessionId: row.sessionId }, row.id, latest, parent.updatedAt);
        }
      }); } catch (error) { if (!(error instanceof RepositoryError) || error.code !== 'SESSION_EXPIRED') throw error; }
    }
  }
}
/** Polls return this canonical view; generation is the only presentation-only remap. */
export function canonicalDateView(input: DatePriceQuery): DatePriceQuery {
  const parsed = DatePriceQuerySchema.parse(input);
  const dates = [...new Set(parsed.dates)].sort();
  const query = { ...canonicalTransportQuery(parsed.query), sort: 'cheapest' as const };
  if (parsed.leg === 'outbound') query.departureDate = dates.find(date => !query.returnDate || date <= query.returnDate) ?? query.returnDate!;
  else query.returnDate = dates.find(date => date >= query.departureDate) ?? query.departureDate;
  return DatePriceQuerySchema.parse({ ...parsed, dates, query });
}
