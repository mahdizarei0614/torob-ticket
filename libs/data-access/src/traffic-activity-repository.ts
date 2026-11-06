import {PopulateTrafficSchema,ReferralIntentSchema,ReferralReceiptSchema,type PopulateTraffic,type ReferralQuoteSchema,type SearchSnapshot,type HotelSearchSnapshot,type RawProviderRecord,type NormalizationTrace,type NormalizedOffer,type TransportSearchQuery,type HotelSearchQuery} from '@torob-ticket/contracts';
import type {z} from 'zod';
import type {SourceFareEvidence} from '@torob-ticket/domain';
import {Prisma,type PrismaClient} from './generated/client';
import {RepositoryError,type DataScope} from './scope';
import {activityId,TRAFFIC_ACTIVITY_MARKER,TRAFFIC_ACTIVITY_VERSION,type TrafficActivityPlan} from './traffic-activity-plan';
export interface ActivitySource {
 key:string;searchId:string;query:TransportSearchQuery|HotelSearchQuery;
 payload:z.infer<typeof ReferralQuoteSchema>;snapshot:SearchSnapshot|HotelSearchSnapshot;
 raw?:RawProviderRecord;trace?:NormalizationTrace;offer?:NormalizedOffer;fareSource?:SourceFareEvidence;
}
const json=(x:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(x));
const chunk=async<T>(rows:T[],insert:(rows:T[])=>Promise<unknown>)=>{for(let i=0;i<rows.length;i+=64)await insert(rows.slice(i,i+64));};
/** Explicit authored-history import. Never called by an ordinary read/bootstrap. */
export class TrafficActivityRepository {
 constructor(private readonly db:PrismaClient){}
 async existing(scope:DataScope):Promise<PopulateTraffic|null>{
  const row=await this.db.auditEvent.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:TRAFFIC_ACTIVITY_MARKER}}});
  if(row)return PopulateTrafficSchema.parse({...((row.payload as Prisma.JsonObject).summary as Prisma.JsonObject),status:'already-loaded'});
  // Avoid rebuilding thousands of source templates for a protected workspace.
  // The authoritative check is repeated under the write lock in populate.
  if(await this.db.outboundReferral.count({where:{sessionId:scope.sessionId}})||await this.db.providerTariff.count({where:{sessionId:scope.sessionId}}))throw new RepositoryError('TRAFFIC_HISTORY_CONFLICT');
  return null;
 }
 async populate(scope:DataScope,plan:TrafficActivityPlan,sources:ActivitySource[],identity:{fixtureVersion:string;mappingRevision:string}):Promise<PopulateTraffic>{
  const byKey=new Map(sources.map(source=>[source.key,source]));
  const prepared=plan.visits.map(visit=>{
   const source=byKey.get(visit.templateKey);if(!source)throw new Error('Missing activity source');
   const intentId=activityId('intent',visit.id),selection={kind:visit.kind,quoteId:source.payload.quote.quoteId,quoteVersion:1};
   const createdAt=new Date(Math.max(Date.parse(source.payload.quote.observedAt),visit.at.getTime()-100)),expiresAt=new Date(Math.min(Date.parse(source.payload.quote.expiresAt),createdAt.getTime()+120000));
   const intent=ReferralIntentSchema.parse({intentId,selection,quote:source.payload,createdAt:createdAt.toISOString(),expiresAt:expiresAt.toISOString()});
   const receipt=ReferralReceiptSchema.parse({referralId:visit.id,intentId,selection,payload:source.payload,confirmedAt:visit.at.toISOString(),handoffPath:'/provider-demo/'+visit.id});
   if(visit.at.getTime()>=Date.parse(source.payload.quote.expiresAt)||visit.at.getTime()<Date.parse(source.payload.quote.observedAt))throw new Error('Activity visit outside quoted validity');
   return {visit,intent,receipt,createdAt,expiresAt};
  });
  const summary:PopulateTraffic={status:'loaded',outbound:plan.visits.length,billable:plan.visits.filter(v=>v.billable).length,repeats:plan.visits.filter(v=>!v.billable).length,monthKeys:plan.monthKeys,providerCount:plan.tariffs.length};
  return this.db.$transaction(async tx=>{
   const owned=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "DemoSession" WHERE id=${scope.sessionId} FOR UPDATE`;if(!owned.length)throw new RepositoryError('SESSION_EXPIRED');
   const marker=await tx.auditEvent.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:TRAFFIC_ACTIVITY_MARKER}}});
   if(marker)return PopulateTrafficSchema.parse({...((marker.payload as Prisma.JsonObject).summary as Prisma.JsonObject),status:'already-loaded'});
   if(await tx.outboundReferral.count({where:{sessionId:scope.sessionId}})||await tx.providerTariff.count({where:{sessionId:scope.sessionId}}))throw new RepositoryError('TRAFFIC_HISTORY_CONFLICT');
   const transports=sources.filter(source=>source.payload.kind==='transport'),hotels=sources.filter(source=>source.payload.kind==='hotel');
   await chunk(transports.map(source=>({sessionId:scope.sessionId,id:source.searchId,clientGeneration:activityId('generation',source.key),query:json(source.query),status:'complete',snapshot:json(source.snapshot),mappingRevision:identity.mappingRevision,fixtureVersion:identity.fixtureVersion,createdAt:new Date(source.payload.quote.observedAt),updatedAt:new Date(source.payload.quote.observedAt)})),rows=>tx.searchRun.createMany({data:rows}));
   await chunk(transports.map(source=>({sessionId:scope.sessionId,id:activityId('provider-run',source.key),searchId:source.searchId,providerId:source.payload.quote.providerId,status:'complete',payload:json({providerId:source.payload.quote.providerId,status:'complete',offerCount:1})})),rows=>tx.providerRun.createMany({data:rows}));
   await chunk(transports.map(source=>({sessionId:scope.sessionId,id:source.raw!.rawRecordId,providerRunId:activityId('provider-run',source.key),sourceNamespace:source.raw!.sourceNamespace,fixtureVersion:identity.fixtureVersion,observedAt:new Date(source.raw!.observedAt),payload:json({raw:source.raw,sourceRawRecordId:source.raw!.rawRecordId,import:{kind:'authored-activity-history',version:TRAFFIC_ACTIVITY_VERSION}})})),rows=>tx.rawRecord.createMany({data:rows}));
   await chunk(transports.map(source=>({sessionId:scope.sessionId,id:source.trace!.traceId,rawRecordId:source.raw!.rawRecordId,mappingRevision:identity.mappingRevision,payload:json(source.trace),createdAt:new Date(source.trace!.observedAt)})),rows=>tx.normalizationDecision.createMany({data:rows}));
   await chunk(transports.map(source=>({sessionId:scope.sessionId,id:source.offer!.offerId,searchId:source.searchId,payload:json({offer:source.offer,source:source.fareSource}),createdAt:new Date(source.offer!.observedAt)})),rows=>tx.offerSnapshot.createMany({data:rows}));
   await chunk(hotels.map(source=>({sessionId:scope.sessionId,id:source.searchId,queryKey:activityId('hotel-query',source.key),payload:json({kind:'hotel-activity-history',snapshot:source.snapshot,query:source.query,provenance:{kind:'authored-activity-history',version:TRAFFIC_ACTIVITY_VERSION}}),createdAt:new Date(source.payload.quote.observedAt)})),rows=>tx.hotelSearchRun.createMany({data:rows}));
   await chunk(sources.map(source=>({sessionId:scope.sessionId,id:source.payload.quote.quoteId,version:1,...source.payload.kind==='transport'?{offerId:source.offer!.offerId}:{hotelSearchId:source.searchId},payload:json(source.payload.quote),observedAt:new Date(source.payload.quote.observedAt),expiresAt:new Date(source.payload.quote.expiresAt)})),rows=>tx.quote.createMany({data:rows}));
   await chunk(prepared.map(({intent,createdAt,expiresAt})=>({sessionId:scope.sessionId,id:intent.intentId,quoteId:intent.selection.quoteId,quoteVersion:1,payload:json({intent,provenance:{kind:'authored-activity-history',version:TRAFFIC_ACTIVITY_VERSION}}),createdAt,expiresAt})),rows=>tx.referralIntent.createMany({data:rows}));
   await chunk(prepared.map(({receipt,visit})=>({sessionId:scope.sessionId,id:receipt.referralId,intentId:receipt.intentId,idempotencyKey:activityId('accepted',visit.id),payloadHash:activityId('payload',receipt),payload:json(receipt),createdAt:visit.at})),rows=>tx.referralEvent.createMany({data:rows}));
   await chunk(plan.visits.map(visit=>({sessionId:scope.sessionId,referralId:visit.id,providerId:visit.providerId,visitorKey:visit.visitorKey,kind:visit.kind,redirectedAt:visit.at,billable:visit.billable,reason:visit.billable?'eligible':'repeat-within-hour',monthKey:visit.monthKey,monthOrdinal:visit.ordinal===null?null:BigInt(visit.ordinal),rateRial:visit.rateRial===null?null:BigInt(visit.rateRial),tariffRevision:visit.tariff.revision,tierIndex:visit.tierIndex})),rows=>tx.outboundReferral.createMany({data:rows}));
   await chunk(plan.visits.map(visit=>({sessionId:scope.sessionId,id:activityId('audit',visit.id),kind:'activity-history-referral-imported',createdAt:visit.at,payload:json({intentId:activityId('intent',visit.id),referralId:visit.id,providerId:visit.providerId,monthKey:visit.monthKey,monthOrdinal:visit.ordinal,rateRial:visit.rateRial,tariff:visit.tariff,policy:{windowMinutes:60,pricing:'graduated',visitorBasis:'visitor-session'},provenance:{kind:'authored-activity-history',version:TRAFFIC_ACTIVITY_VERSION,externalDeliveryPerformed:false}})})),rows=>tx.auditEvent.createMany({data:rows}));
   await tx.providerTariff.createMany({data:plan.tariffs.map(tariff=>({sessionId:scope.sessionId,providerId:tariff.providerId,revision:tariff.revision,payload:json(tariff),updatedAt:new Date(tariff.updatedAt!)}))});
   await tx.auditEvent.create({data:{sessionId:scope.sessionId,id:TRAFFIC_ACTIVITY_MARKER,kind:'activity-history-imported',createdAt:plan.generatedAt,payload:json({summary,version:TRAFFIC_ACTIVITY_VERSION,source:'deterministic-authored-history',externalDeliveryPerformed:false})}});
   return PopulateTrafficSchema.parse(summary);
  },{maxWait:10000,timeout:120000});
 }
}
