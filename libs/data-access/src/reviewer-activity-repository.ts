import {PopulateTrafficSchema,type SessionInfo} from '@torob-ticket/contracts';
import {Prisma,type PrismaClient} from './generated/client';
import {RepositoryError,scopedTransaction,type DataScope} from './scope';
import {activityId,TRAFFIC_ACTIVITY_MARKER,TRAFFIC_ACTIVITY_VERSION} from './traffic-activity-plan';
import {localTrafficDate,persianMonth} from './provider-billing';

export const REVIEWER_ACTIVITY_VERSION='reviewer-activity-v1';
export const REVIEWER_ACTIVITY_SETUP='reviewer-activity-setup-v1';
export const REVIEWER_ACTIVITY_DONE='reviewer-activity-complete-v1';
type Identity=Pick<SessionInfo,'fixtureVersion'|'catalogRevision'|'mappingRevision'>;
export function reviewerActivityTemplateId(identity:Identity,now:Date){return activityId('template-workspace',REVIEWER_ACTIVITY_VERSION,TRAFFIC_ACTIVITY_VERSION,identity.fixtureVersion,identity.catalogRevision,identity.mappingRevision,localTrafficDate(now),persianMonth(now).key);}
const credential=(id:string)=>'internal-activity-template:'+id; // Never a SHA256 browser credential.
// Deliberate column/table allowlist: identity, credentials, SSO, saved searches,
// overrides and template housekeeping are never copied into a reviewer.
const historyTables:readonly(readonly[string,readonly string[]])[]=[
 ['SearchRun',['id','predecessorId','clientGeneration','query','status','snapshot','mappingRevision','fixtureVersion','createdAt','updatedAt']],
 ['ProviderRun',['id','searchId','providerId','status','payload']],
 ['RawRecord',['id','providerRunId','sourceNamespace','fixtureVersion','observedAt','payload']],
 ['NormalizationDecision',['id','rawRecordId','mappingRevision','payload','createdAt']],
 ['OfferSnapshot',['id','searchId','payload','createdAt']],
 ['HotelSearchRun',['id','queryKey','payload','createdAt']],
 ['Quote',['id','version','offerId','hotelSearchId','payload','observedAt','expiresAt']],
 ['ReferralIntent',['id','quoteId','quoteVersion','payload','createdAt','expiresAt']],
 ['ReferralEvent',['id','intentId','idempotencyKey','payloadHash','payload','createdAt']],
 ['OutboundReferral',['referralId','providerId','visitorKey','kind','redirectedAt','billable','reason','monthKey','monthOrdinal','rateRial','tariffRevision','tierIndex']],
 ['ProviderTariff',['providerId','revision','payload','updatedAt']],
 ['AuditEvent',['id','kind','createdAt','payload']],
];
const summary=(payload:Prisma.JsonValue,status:'loaded'|'already-loaded')=>PopulateTrafficSchema.parse({...((payload as Prisma.JsonObject).summary as Prisma.JsonObject),status});

export class ReviewerActivityRepository {
 constructor(private readonly db:PrismaClient){}
 async ensureTemplate(identity:Identity,now:Date){
  const id=reviewerActivityTemplateId(identity,now);
  await this.db.demoSession.upsert({where:{id},update:{},create:{id,credentialHash:credential(id),seed:73n,anchorInstant:now,scenario:'normal',scenarioRevision:REVIEWER_ACTIVITY_VERSION,fixtureVersion:identity.fixtureVersion,mappingRevision:identity.mappingRevision,createdAt:now,lastSeenAt:now,expiresAt:new Date(now.getTime()+48*3600000),mappings:{create:{id:identity.mappingRevision,patch:{},createdAt:now}}}});
  return {sessionId:id};
 }
 async begin(scope:DataScope){return scopedTransaction(this.db,scope,async tx=>{
  await tx.auditEvent.createMany({skipDuplicates:true,data:{sessionId:scope.sessionId,id:REVIEWER_ACTIVITY_SETUP,kind:'reviewer-activity-setup',payload:{version:REVIEWER_ACTIVITY_VERSION,status:'pending'},createdAt:new Date()}});
 });}
 async pending(scope:DataScope){const rows=await this.db.auditEvent.findMany({where:{sessionId:scope.sessionId,id:{in:[REVIEWER_ACTIVITY_SETUP,REVIEWER_ACTIVITY_DONE]}}});const value=rows.find(row=>row.id===REVIEWER_ACTIVITY_SETUP)?.payload as Prisma.JsonObject|undefined;return value?.version===REVIEWER_ACTIVITY_VERSION&&value.status==='pending'&&!rows.some(row=>row.id===REVIEWER_ACTIVITY_DONE);}
 async finish(scope:DataScope,status:'ready'|'skipped-existing-data'){return scopedTransaction(this.db,scope,async tx=>{
  // Audit evidence is append-only. A separate completion makes retries safe
  // even when the history committed but the response/completion was interrupted.
  await tx.auditEvent.createMany({skipDuplicates:true,data:{sessionId:scope.sessionId,id:REVIEWER_ACTIVITY_DONE,kind:'reviewer-activity-complete',payload:{version:REVIEWER_ACTIVITY_VERSION,status},createdAt:new Date()}});
 });}
 async copy(scope:DataScope,source:DataScope){
  if(!source.sessionId.startsWith('activity-template-workspace-')||scope.sessionId.startsWith('activity-template-workspace-'))throw new RepositoryError('INVALID_QUERY');
  return this.db.$transaction(async tx=>{
   const target=await tx.$queryRaw<{fixtureVersion:string;mappingRevision:string}[]>`SELECT "fixtureVersion","mappingRevision" FROM "DemoSession" WHERE id=${scope.sessionId} FOR UPDATE`;
   if(!target.length)throw new RepositoryError('SESSION_EXPIRED');
   // Hold the source against expiry/cascade for every INSERT SELECT, not only
   // the ready-marker read. Source locks remain compatible across reviewers.
   const locked=await tx.$queryRaw<{fixtureVersion:string;mappingRevision:string;credentialHash:string;scenarioRevision:string}[]>`SELECT "fixtureVersion","mappingRevision","credentialHash","scenarioRevision" FROM "DemoSession" WHERE id=${source.sessionId} FOR SHARE`;
   const origin=locked[0];if(!origin)throw new RepositoryError('NOT_FOUND');
   if(origin.credentialHash!==credential(source.sessionId)||origin.scenarioRevision!==REVIEWER_ACTIVITY_VERSION||origin.fixtureVersion!==target[0]!.fixtureVersion||origin.mappingRevision!==target[0]!.mappingRevision)throw new RepositoryError('INVALID_QUERY');
   const previous=await tx.auditEvent.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:TRAFFIC_ACTIVITY_MARKER}}});if(previous)return summary(previous.payload,'already-loaded');
   if(await tx.outboundReferral.count({where:{sessionId:scope.sessionId}})||await tx.providerTariff.count({where:{sessionId:scope.sessionId}}))throw new RepositoryError('TRAFFIC_HISTORY_CONFLICT');
   const marker=await tx.auditEvent.findUnique({where:{sessionId_id:{sessionId:source.sessionId,id:TRAFFIC_ACTIVITY_MARKER}}});
   if(!marker||marker.kind!=='activity-history-imported'||(marker.payload as Prisma.JsonObject).version!==TRAFFIC_ACTIVITY_VERSION)throw new RepositoryError('NOT_FOUND');
   const expected=summary(marker.payload,'loaded');
   for(const [table,columns] of historyTables){
    const name=Prisma.raw('"'+table+'"'),names=Prisma.join(columns.map(column=>Prisma.raw('"'+column+'"')));
    const audits=table==='AuditEvent'?Prisma.sql`AND (kind='activity-history-referral-imported' OR (kind='activity-history-imported' AND id=${TRAFFIC_ACTIVITY_MARKER}))`:Prisma.empty;
    await tx.$executeRaw(Prisma.sql`INSERT INTO ${name} ("sessionId",${names}) SELECT ${scope.sessionId},${names} FROM ${name} WHERE "sessionId"=${source.sessionId} ${audits}`);
   }
   if(await tx.outboundReferral.count({where:{sessionId:scope.sessionId}})!==expected.outbound)throw new RepositoryError('INVALID_QUERY');
   return expected;
  },{maxWait:10000,timeout:60000});
 }
}
