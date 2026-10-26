import { createHash, randomUUID } from 'node:crypto';
import { MappingPatchSchema, MappingImpactPreviewSchema, NormalizationTraceSchema, type MappingPatch, type MappingImpactPreview, type ApplyMappingInput, type MappingApplied, type MappingListQuery } from '@torob-ticket/contracts';
import { canonicalValue } from '@torob-ticket/domain';
import { Prisma, type PrismaClient } from './generated/client';
import { sessionInfo } from './session-repository';
import { RepositoryError, scopedTransaction, type DataScope } from './scope';
import { readProviderContext } from './search-repository';
import { invalidateSessionWork } from './admin-controls-repository';
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
const digest = (value: unknown) => createHash('sha256').update(canonicalValue(value)).digest('hex');
export const MAPPING_PREVIEW_MS = 10 * 60 * 1000;

export const MAPPING_EVIDENCE_LIMIT = 500;
class MappingWindowTooLarge extends Error {}
const comparisonSql = (scope: DataScope) => Prisma.sql`s."sessionId" = ${scope.sessionId} AND jsonb_typeof(s.snapshot->'searchId') = 'string' AND NOT EXISTS (SELECT 1 FROM "DatePriceRun" d WHERE d."sessionId" = s."sessionId" AND d.id = s.id)`;
const rawSql = (scope: DataScope, outcome?: string) => Prisma.sql`${comparisonSql(scope)} AND r."sessionId" = ${scope.sessionId} ${outcome ? Prisma.sql`AND EXISTS (SELECT 1 FROM "NormalizationDecision" n WHERE n."sessionId" = r."sessionId" AND n."rawRecordId" = r.id AND n.payload->>'outcome' = ${outcome})` : Prisma.empty}`;
async function loadRows(tx: Prisma.TransactionClient, scope: DataScope, rawIds: string[], searchIds: string[], revisionOffset = 0, revisionLimit = MAPPING_EVIDENCE_LIMIT) {
  const traceWhere={sessionId:scope.sessionId,rawRecordId:{in:rawIds}};
  if(await tx.normalizationDecision.count({where:traceWhere})>MAPPING_EVIDENCE_LIMIT) throw new MappingWindowTooLarge();
  const traces=await tx.normalizationDecision.findMany({where:traceWhere,orderBy:{id:'asc'},take:MAPPING_EVIDENCE_LIMIT});
  const offerIds=traces.flatMap(t=>{const trace=NormalizationTraceSchema.safeParse(t.payload);return trace.success&&trace.data.offerId?[trace.data.offerId]:[];});
  const [rawRecords, offers, searches, revisions] = await Promise.all([
    tx.rawRecord.findMany({ where: { sessionId: scope.sessionId, id: { in: rawIds } }, include: { providerRun: { select: { searchId: true } } }, orderBy: { id: 'asc' }, take: MAPPING_EVIDENCE_LIMIT }),
    tx.offerSnapshot.findMany({ where: { sessionId: scope.sessionId, searchId: { in: searchIds }, id: { in: offerIds } }, orderBy: { id: 'asc' }, take: MAPPING_EVIDENCE_LIMIT }),
    tx.searchRun.findMany({ where: { sessionId: scope.sessionId, id: { in: searchIds } }, orderBy: { id: 'asc' }, take: MAPPING_EVIDENCE_LIMIT }),
    tx.mappingRevision.findMany({ where: { sessionId: scope.sessionId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: revisionOffset, take: revisionLimit }),
  ]);
  return { rawRecords, traces, offers, searches, revisions };
}
async function load(tx: Prisma.TransactionClient, scope: DataScope) {
  const searchCount=await tx.$queryRaw<{count:number}[]>(Prisma.sql`SELECT count(*)::int AS count FROM "SearchRun" s WHERE ${comparisonSql(scope)}`);
  const rawCount=await tx.$queryRaw<{count:number}[]>(Prisma.sql`SELECT count(*)::int AS count FROM "RawRecord" r JOIN "ProviderRun" p ON p."sessionId"=r."sessionId" AND p.id=r."providerRunId" JOIN "SearchRun" s ON s."sessionId"=p."sessionId" AND s.id=p."searchId" WHERE ${rawSql(scope)}`);
  const revisionCount=await tx.mappingRevision.count({where:{sessionId:scope.sessionId}});
  if(searchCount[0]!.count>MAPPING_EVIDENCE_LIMIT || rawCount[0]!.count>MAPPING_EVIDENCE_LIMIT || revisionCount>MAPPING_EVIDENCE_LIMIT) throw new MappingWindowTooLarge();
  const searchIds=(await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT s.id FROM "SearchRun" s WHERE ${comparisonSql(scope)} ORDER BY s.id LIMIT ${MAPPING_EVIDENCE_LIMIT}`)).map(r=>r.id);
  const rawIds=(await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT r.id FROM "RawRecord" r JOIN "ProviderRun" p ON p."sessionId"=r."sessionId" AND p.id=r."providerRunId" JOIN "SearchRun" s ON s."sessionId"=p."sessionId" AND s.id=p."searchId" WHERE ${rawSql(scope)} ORDER BY r.id LIMIT ${MAPPING_EVIDENCE_LIMIT}`)).map(r=>r.id);
  const traceCount=await tx.normalizationDecision.count({where:{sessionId:scope.sessionId,rawRecordId:{in:rawIds}}});
  const offerCount=await tx.offerSnapshot.count({where:{sessionId:scope.sessionId,searchId:{in:searchIds}}});
  if(traceCount>MAPPING_EVIDENCE_LIMIT || offerCount>MAPPING_EVIDENCE_LIMIT) throw new MappingWindowTooLarge();
  const session = await tx.demoSession.findUniqueOrThrow({ where: { id: scope.sessionId } });
  const context = await readProviderContext(tx, scope, session);
  return { context, ...await loadRows(tx,scope,rawIds,searchIds) };
}
export type AdminMappingData = Awaited<ReturnType<typeof load>>;
export type MappingEvaluator = (data: AdminMappingData, patch: MappingPatch, previewId: string, now: Date) => MappingImpactPreview;
function evidenceFingerprint(data: AdminMappingData) {
  return digest({ revision: data.context.info.mappingRevision, fixtureVersion: data.context.info.fixtureVersion, catalogRevision: data.context.info.catalogRevision, seed: data.context.info.seed, anchorInstant: data.context.info.anchorInstant, scenario: data.context.info.scenario, scenarioRevision: data.context.info.scenarioRevision, overrides: [...data.context.overrides].sort((a,b)=>a.providerId.localeCompare(b.providerId)),
    raw: data.rawRecords.map(r => [r.id, r.providerRun.searchId, r.payload]), traces: data.traces.map(r => [r.id, r.payload]), offers: data.offers.map(r => [r.id, r.searchId, r.payload]), searches: data.searches.map(r => [r.id, r.query, r.snapshot]) });
}
/** Preview and application serialize with revision mutation, reset and evidence writers. */
export class AdminMappingRepository {
  constructor(private readonly db: PrismaClient) {}
  read(scope: DataScope) { return scopedTransaction(this.db, scope, async tx => { try { return await load(tx,scope); } catch(e) { if(e instanceof MappingWindowTooLarge) throw new RepositoryError('INVALID_QUERY'); throw e; } }); }
  page(scope: DataScope, query: MappingListQuery) {
    return scopedTransaction(this.db,scope,async tx=>{
      const predicate=rawSql(scope,query.outcome);
      const total=(await tx.$queryRaw<{count:number}[]>(Prisma.sql`SELECT count(*)::int AS count FROM "RawRecord" r JOIN "ProviderRun" p ON p."sessionId"=r."sessionId" AND p.id=r."providerRunId" JOIN "SearchRun" s ON s."sessionId"=p."sessionId" AND s.id=p."searchId" WHERE ${predicate}`))[0]!.count;
      const rows=await tx.$queryRaw<{id:string;searchId:string}[]>(Prisma.sql`SELECT r.id,p."searchId" FROM "RawRecord" r JOIN "ProviderRun" p ON p."sessionId"=r."sessionId" AND p.id=r."providerRunId" JOIN "SearchRun" s ON s."sessionId"=p."sessionId" AND s.id=p."searchId" WHERE ${predicate} ORDER BY r.id LIMIT ${query.limit} OFFSET ${query.offset}`);
      const session=await tx.demoSession.findUniqueOrThrow({where:{id:scope.sessionId},include:{fixture:true,identity:true}});
      const revisionsTotal=await tx.mappingRevision.count({where:{sessionId:scope.sessionId}});
      const revisionsOffset=query.revisionOffset??0,revisionsLimit=query.revisionLimit??25;
      const data={context:{info:sessionInfo(session),mappings:[],overrides:[]},...await loadRows(tx,scope,rows.map(r=>r.id),[...new Set(rows.map(r=>r.searchId))],revisionsOffset,revisionsLimit)};
      return {data,totalRecords:total,revisionsTotal,revisionsOffset,revisionsLimit,revisionsHasMore:revisionsOffset+revisionsLimit<revisionsTotal};
    });
  }
  preview(scope: DataScope, patch: MappingPatch, now: Date, evaluate: MappingEvaluator) {
    return scopedTransaction(this.db, scope, async tx => {
      const session=await tx.demoSession.findUniqueOrThrow({where:{id:scope.sessionId}});
      if(session.mappingRevision!==patch.baseRevision) throw new RepositoryError('MAPPING_COLLISION');
      let data:AdminMappingData;
      try { data=await load(tx,scope); } catch(e) {
        if(!(e instanceof MappingWindowTooLarge)) throw e;
        const preview:MappingImpactPreview={patch,previewId:randomUUID(),valid:false,collisions:[],affectedRawRecordIds:[],affectedSearchIds:[],issues:[{code:'MAPPING_PREVIEW_TOO_LARGE',fieldPath:[],severity:'rejected'}],impacts:[],groupingChanges:[],observedAt:now.toISOString(),expiresAt:new Date(now.getTime()+MAPPING_PREVIEW_MS).toISOString()};
        await tx.auditEvent.create({data:{sessionId:scope.sessionId,id:preview.previewId,kind:'mapping-preview',payload:json({preview,fingerprint:null,evidenceLimit:MAPPING_EVIDENCE_LIMIT}),createdAt:now}});
        return preview;
      }
      if (data.context.info.mappingRevision !== patch.baseRevision) throw new RepositoryError('MAPPING_COLLISION');
      const previewId = randomUUID();
      const preview = MappingImpactPreviewSchema.parse(evaluate(data, MappingPatchSchema.parse(patch), previewId, now));
      await tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: previewId, kind: 'mapping-preview', payload: json({ preview, fingerprint: evidenceFingerprint(data) }), createdAt: now } });
      return preview;
    });
  }
  apply(scope: DataScope, input: ApplyMappingInput, now: Date, evaluate: MappingEvaluator): Promise<MappingApplied> {
    return scopedTransaction(this.db, scope, async tx => {
      const saved = await tx.auditEvent.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: input.previewId } } });
      if (!saved || saved.kind !== 'mapping-preview') throw new RepositoryError('NOT_FOUND');
      const payload = saved.payload as Prisma.JsonObject;
      const preview = MappingImpactPreviewSchema.parse(payload['preview']);
      if (canonicalValue(input.patch) !== canonicalValue(preview.patch)) throw new RepositoryError('INVALID_QUERY');
      if (!preview.valid) throw new RepositoryError('INVALID_QUERY');
      let data:AdminMappingData;
      try { data=await load(tx,scope); } catch(e) { if(e instanceof MappingWindowTooLarge) throw new RepositoryError('MAPPING_COLLISION'); throw e; }
      if (now.getTime() >= Date.parse(preview.expiresAt) || data.context.info.mappingRevision !== input.patch.baseRevision || payload['fingerprint'] !== evidenceFingerprint(data)) throw new RepositoryError('MAPPING_COLLISION');
      const current = evaluate(data, input.patch, input.previewId, new Date(preview.observedAt));
      if (!current.valid || canonicalValue(current) !== canonicalValue(preview)) throw new RepositoryError('MAPPING_COLLISION');
      const revision = randomUUID();
      await tx.mappingRevision.create({ data: { sessionId: scope.sessionId, id: revision, parentId: input.patch.baseRevision, patch: json(input.patch), createdAt: now } });
      await tx.demoSession.update({ where: { id: scope.sessionId }, data: { mappingRevision: revision } });
      await invalidateSessionWork(this.db, tx, scope, now, 'mapping-changed');
      const result: MappingApplied = { revision, parentRevision: input.patch.baseRevision, appliedAt: now.toISOString(), affectedRawRecordIds: preview.affectedRawRecordIds, affectedSearchIds: preview.affectedSearchIds };
      await tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind: 'mapping-applied', payload: json({ ...result, previewId: input.previewId, patch: input.patch }), createdAt: now } });
      return result;
    });
  }
}
