import { NormalizationTraceSchema, NormalizedOfferSchema, RawProviderRecordSchema, type RawProviderRecord, type NormalizationTrace, type NormalizedOffer } from '@torob-ticket/contracts';
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
      if(!run) throw new RepositoryError('NOT_FOUND');
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
  create(scope: DataScope, input: CreateSearchRun, now: Date) {
    return scopedTransaction(this.db, scope, async tx => {
      if (input.predecessorId && !await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: input.predecessorId } } })) throw new RepositoryError('NOT_FOUND');
      const session = await tx.demoSession.findUniqueOrThrow({ where: { id: scope.sessionId } });
      return tx.searchRun.create({ data: { sessionId: scope.sessionId, id: randomUUID(), ...input, status: 'collecting', mappingRevision: session.mappingRevision, fixtureVersion: session.fixtureVersion, createdAt: now, updatedAt: now } });
    });
  }
  async get(scope: DataScope, id: string) {
    const run = await this.db.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
    if (!run) throw new RepositoryError('NOT_FOUND');
    return run;
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
