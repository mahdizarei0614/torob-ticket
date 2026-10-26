import { MappingPatchSchema, NormalizationTraceSchema, NormalizedOfferSchema, RawProviderRecordSchema, TransportSearchQuerySchema, type MappingPatch, type MappingImpactPreview, type MappingListQuery, type MappingWorkspace, type ApplyMappingInput } from '@torob-ticket/contracts';
import { cleanAlias, resolveAlias, normalizeRecord, itineraryKey, type AliasMapping } from '@torob-ticket/domain';
import { catalogForIdentity } from '@torob-ticket/fixtures';
import { decodeRawRecord } from '@torob-ticket/provider-adapters';
import { AdminMappingRepository, MAPPING_PREVIEW_MS, MAPPING_EVIDENCE_LIMIT, type AdminMappingData } from '@torob-ticket/data-access';
import type { SessionContext } from '../sessions/session-context';
import type { SessionService } from '../sessions/session.service';

function aliasesFor(data: AdminMappingData): AliasMapping[] {
  const aliases: AliasMapping[] = [{entityType:'city',sourceNamespace:'demo-provider-03/v1',sourceValue:'Istanbul / استانبول',targetId:'istanbul'}];
  for (const candidate of data.context.mappings) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate) && !Object.keys(candidate).length) continue;
    const patch=MappingPatchSchema.parse(candidate);
    for(let i=aliases.length-1;i>=0;i--) if(aliases[i]!.entityType===patch.entityType && aliases[i]!.sourceNamespace===patch.sourceNamespace && cleanAlias(aliases[i]!.sourceValue)===cleanAlias(patch.sourceValue)) aliases.splice(i,1);
    aliases.push(patch);
  }
  return aliases;
}
export function mappingRecords(data: AdminMappingData): MappingWorkspace['records'] {
  const records: MappingWorkspace['records']=[];
  for(const row of data.rawRecords) {
    const payload=row.payload as Record<string,unknown>;
    const raw=RawProviderRecordSchema.safeParse(payload['raw']);
    const run=data.searches.find(s=>s.id===row.providerRun.searchId);
    const query=TransportSearchQuerySchema.safeParse(run?.query);
    // Internal recheck operations are evidence, not replayable comparison records.
    if(!raw.success || !query.success || !run || (run.snapshot as Record<string,unknown>)['kind']==='referral-recheck') continue;
    const saved=data.traces.find(t=>t.rawRecordId===row.id);
    const trace=NormalizationTraceSchema.safeParse(saved?.payload);
    if(!trace.success) continue;
    const offerRow=data.offers.find(o=>o.id===trace.data.offerId && o.searchId===run.id);
    const parsedOffer=NormalizedOfferSchema.safeParse((offerRow?.payload as Record<string,unknown>|undefined)?.['offer']);
    const normalizedOffer=parsedOffer.success?parsedOffer.data:null;
    records.push({searchId:run.id,query:query.data,raw:raw.data,trace:trace.data,normalizedOffer,groupId:normalizedOffer?itineraryKey(normalizedOffer.itinerary):null});
  }
  return records;
}
/** Candidate grouping is physical-journey identity; it does not predict fare eligibility or ranking. */
export function evaluateMapping(data: AdminMappingData, patch: MappingPatch, previewId: string, now: Date): MappingImpactPreview {
  const catalog=catalogForIdentity(data.context.info.fixtureVersion,data.context.info.catalogRevision);
  const aliases=aliasesFor(data);
  const result: MappingImpactPreview={patch,previewId,valid:true,collisions:[],affectedRawRecordIds:[],affectedSearchIds:[],issues:[],impacts:[],groupingChanges:[],observedAt:now.toISOString(),expiresAt:new Date(now.getTime()+MAPPING_PREVIEW_MS).toISOString()};
  const issue=(code:string,field:string)=>{result.valid=false;result.issues.push({code,fieldPath:[field],severity:'rejected'});};
  if([data.rawRecords,data.traces,data.offers,data.searches,data.revisions].some(rows=>rows.length>MAPPING_EVIDENCE_LIMIT)) { issue('MAPPING_PREVIEW_TOO_LARGE','sourceValue');return result; }
  if(patch.baseRevision!==data.context.info.mappingRevision) issue('STALE_MAPPING_REVISION','baseRevision');
  if(patch.entityType!=='city') issue('UNSUPPORTED_MAPPING_ENTITY','entityType');
  if(!catalog.providerCapabilities.some(p=>`${p.providerId}/v1`===patch.sourceNamespace)) issue('UNKNOWN_SOURCE_NAMESPACE','sourceNamespace');
  if(!catalog.cities.some(c=>c.id===patch.targetId)) issue('INVALID_ENTITY_TARGET','targetId');
  if(!cleanAlias(patch.sourceValue)) issue('EMPTY_ALIAS','sourceValue');
  const explicit=catalog.cities.find(c=>c.id===patch.sourceValue);
  const existing=resolveAlias(patch.sourceValue,patch.sourceNamespace,'city',catalog.cities,aliases);
  const collisions=[...new Set([...existing,patch.targetId])].sort();
  if(existing.some(id=>id!==patch.targetId) || explicit && explicit.id!==patch.targetId) {
    result.collisions.push({sourceValue:patch.sourceValue,targetIds:collisions});issue('MAPPING_ALIAS_COLLISION','sourceValue');
  }
  const proposed=aliases.filter(a=>!(a.entityType===patch.entityType&&a.sourceNamespace===patch.sourceNamespace&&cleanAlias(a.sourceValue)===cleanAlias(patch.sourceValue)));
  proposed.push(patch);
  const records=mappingRecords(data);
  for(const record of records) {
    if(record.raw.sourceNamespace!==patch.sourceNamespace || patch.entityType!=='city') continue;
    let decoded;
    try { decoded=decodeRawRecord(record.raw); } catch { continue; }
    if(![decoded.originAlias,decoded.destinationAlias].some(s=>cleanAlias(s)===cleanAlias(patch.sourceValue))) continue;
    const before={outcome:record.trace.outcome,decisions:record.trace.decisions,issues:record.trace.issues,normalizedOffer:record.normalizedOffer,groupId:record.groupId};
    // Re-evaluate immutable source bytes under the proposed processing revision. No raw envelope is edited or persisted.
    const normalized=normalizeRecord({...decoded,mappingRevision:previewId},{query:record.query,catalog,mappingRevision:previewId,aliases:proposed,realClock:{now:()=>now}});
    const offer=normalized.offer??null;
    result.impacts.push({rawRecordId:record.raw.rawRecordId,searchId:record.searchId,before,after:{outcome:normalized.trace.outcome,decisions:normalized.trace.decisions,issues:normalized.trace.issues,normalizedOffer:offer,groupId:offer?itineraryKey(offer.itinerary):null}});
  }
  result.affectedRawRecordIds=[...new Set(result.impacts.map(i=>i.rawRecordId))].sort();
  result.affectedSearchIds=[...new Set(result.impacts.map(i=>i.searchId))].sort();
  for(const searchId of result.affectedSearchIds) {
    const beforeGroupIds=[...new Set(records.filter(r=>r.searchId===searchId).flatMap(r=>r.groupId?[r.groupId]:[]))].sort();
    const afterGroupIds=[...new Set(records.filter(r=>r.searchId===searchId).flatMap(r=>{const impact=result.impacts.find(i=>i.rawRecordId===r.raw.rawRecordId);const id=impact?impact.after.groupId:r.groupId;return id?[id]:[];}))].sort();
    result.groupingChanges.push({searchId,beforeGroupIds,afterGroupIds});
  }
  return result;
}
export class MappingService {
  constructor(private readonly sessions:SessionService) {}
  get repository() { return new AdminMappingRepository(this.sessions.database); }
  async list(context:SessionContext,query:MappingListQuery):Promise<MappingWorkspace> {
    const page=await this.repository.page(context.scope,query);
    const {data}=page;
    const catalog=catalogForIdentity(data.context.info.fixtureVersion,data.context.info.catalogRevision);
    const records=mappingRecords(data).filter(r=>!query.outcome||r.trace.outcome===query.outcome);
    return {mappingRevision:data.context.info.mappingRevision,supportedEntityTypes:['city'],namespaces:catalog.providerCapabilities.map(p=>`${p.providerId}/v1`),targets:catalog.cities.map(c=>({entityType:'city',id:c.id,name:c.name})),records,totalRecords:page.totalRecords,offset:query.offset,limit:query.limit,hasMore:query.offset+query.limit<page.totalRecords,revisionsTotal:page.revisionsTotal,revisionsOffset:page.revisionsOffset,revisionsLimit:page.revisionsLimit,revisionsHasMore:page.revisionsHasMore,revisions:data.revisions.map(r=>({revision:r.id,parentRevision:r.parentId,patch:Object.keys(r.patch as object).length?MappingPatchSchema.parse(r.patch):null,createdAt:r.createdAt.toISOString()}))};
  }
  preview(context:SessionContext,patch:MappingPatch) { return this.repository.preview(context.scope,patch,this.sessions.realClock.now(),evaluateMapping); }
  async apply(context:SessionContext,input:ApplyMappingInput) {
    const result=await this.repository.apply(context.scope,input,this.sessions.realClock.now(),evaluateMapping);
    this.sessions.cancelCurrentWork(context,'configuration-changed');
    return result;
  }
}
