import { SearchSnapshotSchema, SearchEventSchema, type SearchSnapshot, type SearchEvent, type ProviderStatus, type QuoteSnapshot, NormalizationTraceSchema, NormalizedOfferSchema, RawProviderRecordSchema, type RawProviderRecord, type NormalizationTrace, type NormalizedOffer } from '@torob-ticket/contracts';
import type { SourceFareEvidence } from '@torob-ticket/domain';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from './generated/client';
import { RepositoryError, scopedTransaction, type DataScope } from './scope';
import { sessionInfo } from './session-repository';
const json=(value:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export interface AppendNormalizationEvidence {
  searchId:string; raw:RawProviderRecord; sourceRawRecordId:string; trace:NormalizationTrace; offer?:NormalizedOffer; source?:SourceFareEvidence;
}
export interface CreateSearchRun {
  query: Prisma.InputJsonValue;
  clientGeneration: string;
  snapshot: Prisma.InputJsonValue;
  predecessorId?: string;
}
export interface AppendQuoteVersion {
  searchId: string;
  quoteId: string;
  expectedVersion: number;
  offerId: string;
  payload: Prisma.InputJsonValue;
  event: Prisma.InputJsonObject;
  expiresAt: Date;
}
export class SearchRepository {
  constructor(private readonly db: PrismaClient) {}
  providerContextSnapshot(scope:DataScope,searchId:string) {
    return scopedTransaction(this.db,scope,async tx=>{
      const run=await tx.searchRun.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:searchId}}});
      if(!run) throw new RepositoryError('NOT_FOUND');
      const session=await tx.demoSession.findUniqueOrThrow({where:{id:scope.sessionId},include:{fixture:true,identity:true}});
      const fixture=await tx.fixtureVersion.findUniqueOrThrow({where:{id:run.fixtureVersion}});
      const mappings:Prisma.JsonValue[]=[];const seen=new Set<string>();let id:string|null=run.mappingRevision;
      while(id) {
        if(seen.has(id)) throw new RepositoryError('MAPPING_COLLISION');
        seen.add(id);
        const mapping: {patch:Prisma.JsonValue;parentId:string|null}|null=await tx.mappingRevision.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id}}});
        if(!mapping) throw new RepositoryError('MAPPING_COLLISION');
        mappings.unshift(mapping.patch);id=mapping.parentId;
      }
      const overrides=await tx.providerOverride.findMany({where:{sessionId:scope.sessionId}});
      return {run,info:{...sessionInfo(session),fixtureVersion:run.fixtureVersion,catalogRevision:fixture.catalogRevision,mappingRevision:run.mappingRevision},mappings,overrides};
    });
  }
  appendNormalizationEvidence(scope:DataScope,input:AppendNormalizationEvidence) {
    return scopedTransaction(this.db,scope,async tx=>{
      const run=await tx.searchRun.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:input.searchId}}});
      if(!run || run.status !== 'collecting') throw new RepositoryError('NOT_FOUND');
      const raw=RawProviderRecordSchema.parse(input.raw);const trace=NormalizationTraceSchema.parse(input.trace);
      const offer=input.offer?NormalizedOfferSchema.parse(input.offer):undefined;
      if(run.mappingRevision!==trace.mappingRevision||run.fixtureVersion!==raw.fixtureVersion) throw new RepositoryError('MAPPING_COLLISION');
      if(trace.rawRecordId!==raw.rawRecordId||Boolean(offer)!==(trace.outcome==='accepted')||offer&&(trace.offerId!==offer.offerId||offer.providerId!==raw.providerId||!offer.provenance.every(p=>p.rawRecordId===raw.rawRecordId&&p.mappingRevision===run.mappingRevision&&p.fixtureVersion===run.fixtureVersion))) throw new RepositoryError('INVALID_QUERY');
      const provider=await tx.providerRun.upsert({where:{sessionId_searchId_providerId:{sessionId:scope.sessionId,searchId:run.id,providerId:raw.providerId}},create:{sessionId:scope.sessionId,searchId:run.id,id:randomUUID(),providerId:raw.providerId,status:'collecting',payload:{}},update:{}});
      await tx.rawRecord.create({data:{sessionId:scope.sessionId,id:raw.rawRecordId,providerRunId:provider.id,sourceNamespace:raw.sourceNamespace,fixtureVersion:raw.fixtureVersion,observedAt:new Date(raw.observedAt),payload:json({sourceRawRecordId:input.sourceRawRecordId,raw})}});
      await tx.normalizationDecision.create({data:{sessionId:scope.sessionId,id:trace.traceId,rawRecordId:raw.rawRecordId,mappingRevision:trace.mappingRevision,payload:json(trace),createdAt:new Date(trace.observedAt)}});
      if(offer) await tx.offerSnapshot.create({data:{sessionId:scope.sessionId,id:offer.offerId,searchId:run.id,payload:json({offer,source:input.source}),createdAt:new Date(trace.observedAt)}});
    });
  }
  create(scope: DataScope, input: CreateSearchRun, now: Date, options: { enforceLimit?: boolean; id?: string; supersedesSearchId?: string } = {}) {
    return scopedTransaction(this.db, scope, async tx => {
      if (options.supersedesSearchId) await this.terminate(tx, scope, options.supersedesSearchId, 'cancelled', now);
      if (options.enforceLimit && await tx.searchRun.count({ where: { sessionId: scope.sessionId, status: 'collecting' } }) >= 2) throw new RepositoryError('SEARCH_LIMIT');
      if (input.predecessorId && !await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: input.predecessorId } } })) throw new RepositoryError('NOT_FOUND');
      const session = await tx.demoSession.findUniqueOrThrow({ where: { id: scope.sessionId } });
      return tx.searchRun.create({ data: { sessionId: scope.sessionId, id: options.id ?? randomUUID(), ...input, status: 'collecting', mappingRevision: session.mappingRevision, fixtureVersion: session.fixtureVersion, createdAt: now, updatedAt: now } });
    });
  }
  get(scope: DataScope, id: string) {
    return scopedTransaction(this.db, scope, async tx => {
      const run = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
      if (!run) throw new RepositoryError('NOT_FOUND');
      return run;
    });
  }
  /** All readers use the same lock as projection writers: cursor and snapshot cannot tear. */
  read(scope: DataScope, id: string, after = 0) {
    return scopedTransaction(this.db, scope, async tx => {
      const run = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
      if (!run) throw new RepositoryError('NOT_FOUND');
      const last = await tx.searchEventRecord.aggregate({ where: { sessionId: scope.sessionId, searchId: id }, _max: { sequence: true } });
      const events = await tx.searchEventRecord.findMany({ where: { sessionId: scope.sessionId, searchId: id, sequence: { gt: after } }, orderBy: { sequence: 'asc' }, take: 50 });
      return { snapshot: SearchSnapshotSchema.parse(run.snapshot), sequence: last._max.sequence ?? 0, events: events.map(row => SearchEventSchema.parse(row.payload)) };
    });
  }
  freezeContext(scope: DataScope, id: string, payload: unknown, now: Date) {
    return scopedTransaction(this.db, scope, async tx => {
      const run = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
      if (!run || run.status !== 'collecting') throw new RepositoryError('NOT_FOUND');
      await tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind: 'search-context', payload: json({ searchId: id, context: payload }), createdAt: now } });
    });
  }
  /** Domain projection is synchronous; all input evidence and writes share one transaction. */
  project(scope: DataScope, id: string, now: Date, build: (input: ProjectionInput) => ProjectionResult, provider?: ProviderStatus) {
    return scopedTransaction(this.db, scope, async tx => {
      const run = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
      if (!run) throw new RepositoryError('NOT_FOUND');
      if (run.status !== 'collecting') return SearchSnapshotSchema.parse(run.snapshot);
      if (provider) await tx.providerRun.upsert({ where: { sessionId_searchId_providerId: { sessionId: scope.sessionId, searchId: id, providerId: provider.providerId } }, create: { sessionId: scope.sessionId, searchId: id, id: randomUUID(), providerId: provider.providerId, status: provider.status, payload: json(provider) }, update: { status: provider.status, payload: json(provider) } });
      const offers = await tx.offerSnapshot.findMany({ where: { sessionId: scope.sessionId, searchId: id } });
      const quotes = await tx.quote.findMany({ where: { sessionId: scope.sessionId, offer: { searchId: id } } });
      const previous = SearchSnapshotSchema.parse(run.snapshot);
      if (provider) previous.providerStatuses = previous.providerStatuses.map(row => row.providerId === provider.providerId ? provider : row);
      const result = build({ previous, offers, quotes: quotes.map(row => row.payload as unknown as QuoteSnapshot) });
      const snapshot = SearchSnapshotSchema.parse(result.snapshot);
      for (const row of snapshot.providerStatuses) await tx.providerRun.upsert({ where: { sessionId_searchId_providerId: { sessionId: scope.sessionId, searchId: id, providerId: row.providerId } }, create: { sessionId: scope.sessionId, searchId: id, id: randomUUID(), providerId: row.providerId, status: row.status, payload: json(row) }, update: { status: row.status, payload: json(row) } });
      for (const item of result.quotes) await tx.quote.upsert({ where: { sessionId_id_version: { sessionId: scope.sessionId, id: item.quote.quoteId, version: item.quote.version } }, create: { sessionId: scope.sessionId, id: item.quote.quoteId, version: item.quote.version, offerId: item.offerId, payload: json(item.quote), observedAt: new Date(item.quote.observedAt), expiresAt: new Date(item.quote.expiresAt) }, update: {} });
      await tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind: 'search-projection', payload: json({ searchId: id, ...result.audit }), createdAt: now } });
      if (provider) await this.event(tx, scope, id, snapshot.clientGeneration, { type: 'provider-status', payload: provider }, now);
      await this.event(tx, scope, id, snapshot.clientGeneration, { type: snapshot.status === 'collecting' ? 'snapshot' : 'terminal', payload: snapshot }, now);
      await tx.searchRun.update({ where: { sessionId_id: { sessionId: scope.sessionId, id } }, data: { snapshot: json(snapshot), status: snapshot.status, updatedAt: now } });
      return snapshot;
    });
  }
  private async event(tx: Prisma.TransactionClient, scope: DataScope, searchId: string, clientGeneration: string, value: Pick<SearchEvent, 'type' | 'payload'>, now: Date) {
    const last = await tx.searchEventRecord.aggregate({ where: { sessionId: scope.sessionId, searchId }, _max: { sequence: true } });
    const sequence = (last._max.sequence ?? 0) + 1;
    const payload = SearchEventSchema.parse({ ...value, searchId, clientGeneration, sequence });
    await tx.searchEventRecord.create({ data: { sessionId: scope.sessionId, searchId, sequence, payload: json(payload), createdAt: now } });
  }
  private async terminate(tx: Prisma.TransactionClient, scope: DataScope, id: string, status: 'cancelled' | 'interrupted', now: Date) {
    const run = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
    if (!run) throw new RepositoryError('NOT_FOUND');
    if (run.status !== 'collecting') return;
    const parsed = SearchSnapshotSchema.safeParse(run.snapshot);
    // Old repository-only evidence can predate the public projection contract.
    const snapshot = parsed.success ? { ...parsed.data, status, providerStatuses: parsed.data.providerStatuses.map(row => row.status === 'pending' || row.status === 'running' ? { ...row, status: 'cancelled' as const, reason: status } : row), observedAt: now.toISOString() } : { ...(run.snapshot as Prisma.JsonObject), status };
    if (parsed.success && 'providerStatuses' in snapshot) {
      const value = snapshot as SearchSnapshot;
      value.coverage = { ...value.coverage, pendingProviderIds: [], failedProviderIds: value.providerStatuses.filter(row => row.status !== 'complete').map(row => row.providerId), complete: true };
      value.suggestion = null;
      value.explanations = [];
      for (const provider of value.providerStatuses) await tx.providerRun.updateMany({ where: { sessionId: scope.sessionId, searchId: id, providerId: provider.providerId }, data: { status: provider.status, payload: json(provider) } });
      await this.event(tx, scope, id, run.clientGeneration, { type: 'terminal', payload: value }, now);
    } else {
      const last = await tx.searchEventRecord.aggregate({ where: { sessionId: scope.sessionId, searchId: id }, _max: { sequence: true } });
      const sequence = (last._max.sequence ?? 0) + 1;
      await tx.searchEventRecord.create({ data: { sessionId: scope.sessionId, searchId: id, sequence, payload: json({ searchId: id, clientGeneration: run.clientGeneration, sequence, type: 'terminal', payload: snapshot }), createdAt: now } });
    }
    await tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind: 'search-terminated', payload: json({ searchId: id, status, snapshot, priorProjectionRetained: true }), createdAt: now } });
    await tx.searchRun.update({ where: { sessionId_id: { sessionId: scope.sessionId, id } }, data: { status, snapshot: json(snapshot), updatedAt: now } });
  }
  cancel(scope: DataScope, id: string, now: Date) {
    return scopedTransaction(this.db, scope, tx => this.terminate(tx, scope, id, 'cancelled', now));
  }
  interrupt(scope: DataScope, id: string, now: Date) {
    return scopedTransaction(this.db, scope, tx => this.terminate(tx, scope, id, 'interrupted', now));
  }
  async interruptUnfinished(now: Date) {
    const sessions = await this.db.demoSession.findMany({ where: { searches: { some: { status: 'collecting' } } }, select: { id: true } });
    for (const session of sessions) {
      try { await scopedTransaction(this.db, { sessionId: session.id }, async tx => {
        const runs = await tx.searchRun.findMany({ where: { sessionId: session.id, status: 'collecting' } });
        for (const run of runs) await this.terminate(tx, { sessionId: session.id }, run.id, 'interrupted', now);
      }); } catch (error) { if (!(error instanceof RepositoryError) || error.code !== 'SESSION_EXPIRED') throw error; }
    }
  }
  appendQuoteVersion(scope: DataScope, input: AppendQuoteVersion, now: Date) {
    return scopedTransaction(this.db, scope, async tx => {
      const run = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: input.searchId } } });
      const offer = await tx.offerSnapshot.findFirst({ where: { sessionId: scope.sessionId, id: input.offerId, searchId: input.searchId } });
      if (!run || !offer) throw new RepositoryError('NOT_FOUND');
      const latest = await tx.quote.findFirst({ where: { sessionId: scope.sessionId, id: input.quoteId }, orderBy: { version: 'desc' } });
      if ((latest?.version ?? 0) !== input.expectedVersion || latest && latest.offerId !== input.offerId) throw new RepositoryError('QUOTE_CHANGED');
      const quote = await tx.quote.create({ data: { sessionId: scope.sessionId, id: input.quoteId, version: input.expectedVersion + 1, offerId: input.offerId, payload: input.payload, observedAt: now, expiresAt: input.expiresAt } });
      const last = await tx.searchEventRecord.aggregate({ where: { sessionId: scope.sessionId, searchId: input.searchId }, _max: { sequence: true } });
      const sequence = (last._max.sequence ?? 0) + 1;
      await tx.searchEventRecord.create({ data: { sessionId: scope.sessionId, searchId: input.searchId, sequence, payload: { ...input.event, searchId: input.searchId, clientGeneration: run.clientGeneration, sequence }, createdAt: now } });
      return quote;
    });
  }
}

export interface ProjectionInput {
  previous: SearchSnapshot;
  offers: { id: string; payload: Prisma.JsonValue; createdAt: Date }[];
  quotes: QuoteSnapshot[];
}
export interface ProjectionResult {
  snapshot: SearchSnapshot;
  quotes: { offerId: string; quote: QuoteSnapshot }[];
  audit: Record<string, unknown>;
}
