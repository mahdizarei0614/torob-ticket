import type {RealClock} from '@torob-ticket/domain';
import {randomUUID} from 'node:crypto';
import {OutboundReferralSchema,ProviderTariffSchema,ProviderTrafficSchema,ReferralReceiptSchema,UpdateProviderTariffSchema,type ProviderTariff,type TrafficQuery,type UpdateProviderTariff,type TrafficCounts} from '@torob-ticket/contracts';
import {Prisma,type PrismaClient} from './generated/client';
import {RepositoryError,scopedTransaction,type DataScope} from './scope';
import {BILLING_ZONE,persianMonth,referralCharge,safeTrafficInteger,trafficDayKeys} from './provider-billing';

const json=(x:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(x));
const defaultTariff=(providerId:string):ProviderTariff=>({providerId,revision:'unconfigured-v1',tiers:[{upTo:100,rateRial:null},{upTo:1000,rateRial:null},{upTo:null,rateRial:null}],updatedAt:null});
const rowEvent=(row:{referralId:string;providerId:string;kind:string;redirectedAt:Date;billable:boolean;reason:string;monthKey:string;monthOrdinal:bigint|null;rateRial:bigint|null;tariffRevision:string;tierIndex:number|null})=>OutboundReferralSchema.parse({referralId:row.referralId,providerId:row.providerId,kind:row.kind,redirectedAt:row.redirectedAt.toISOString(),billable:row.billable,reason:row.reason,monthKey:row.monthKey,tariffRevision:row.tariffRevision,tierIndex:row.tierIndex,monthOrdinal:row.monthOrdinal===null?null:safeTrafficInteger(row.monthOrdinal),rateRial:row.rateRial===null?null:safeTrafficInteger(row.rateRial)});
const zero=()=>({outbound:0,uniqueVisitorSessions:0,billable:0,repeats:0,knownFeeRial:0,unpricedBillable:0,transport:0,hotel:0});
const counts=(row:Record<string,unknown>|undefined):TrafficCounts=>row?Object.fromEntries(Object.keys(zero()).map(key=>[key,safeTrafficInteger(row[key]??0)])) as TrafficCounts:zero();
const columns=Prisma.sql`count(*) AS outbound,count(DISTINCT "visitorKey") AS "uniqueVisitorSessions",count(*) FILTER (WHERE billable) AS billable,count(*) FILTER (WHERE NOT billable) AS repeats,COALESCE(sum("rateRial") FILTER (WHERE billable),0)::text AS "knownFeeRial",count(*) FILTER (WHERE billable AND "rateRial" IS NULL) AS "unpricedBillable",count(*) FILTER (WHERE kind='transport') AS transport,count(*) FILTER (WHERE kind='hotel') AS hotel`;
/** Actual redirect-issued evidence. Confirmations alone are not traffic; no historical backfill. */
export class ProviderTrafficRepository {
 constructor(private readonly db:PrismaClient){}
 issue(scope:DataScope,referralId:string,visitorKey:string,clock:RealClock){return scopedTransaction(this.db,scope,async tx=>{
  const now=clock.now();
  if(!visitorKey)throw new RepositoryError('IDENTITY_REQUIRED');
  const previous=await tx.outboundReferral.findUnique({where:{sessionId_referralId:{sessionId:scope.sessionId,referralId}}});
  if(previous)return rowEvent(previous);
  const row=await tx.referralEvent.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:referralId}}});
  if(!row)throw new RepositoryError('NOT_FOUND');
  const receipt=ReferralReceiptSchema.parse(row.payload);
  if(receipt.referralId!==referralId)throw new RepositoryError('NOT_FOUND');
  const providerId=receipt.payload.quote.providerId,month=persianMonth(now);
  if(!visitorKey)throw new RepositoryError('IDENTITY_REQUIRED');
  const configured=await tx.providerTariff.findUnique({where:{sessionId_providerId:{sessionId:scope.sessionId,providerId}}});
  const tariff=configured?ProviderTariffSchema.parse(configured.payload):defaultTariff(providerId);
  if(tariff.providerId!==providerId||configured&&tariff.revision!==configured.revision)throw new RepositoryError('QUOTE_CHANGED');
  const last=await tx.outboundReferral.findFirst({where:{sessionId:scope.sessionId,providerId,visitorKey,billable:true},orderBy:{redirectedAt:'desc'}});
  const highest=await tx.outboundReferral.aggregate({where:{sessionId:scope.sessionId,providerId,monthKey:month.key,billable:true},_max:{monthOrdinal:true}});
  const ordinal=safeTrafficInteger(highest._max.monthOrdinal??0n)+1;
  const charge=referralCharge(now,last?.redirectedAt??null,ordinal,tariff);
  const event=await tx.outboundReferral.create({data:{sessionId:scope.sessionId,referralId,providerId,visitorKey,kind:receipt.selection.kind,redirectedAt:now,...charge,monthKey:month.key,monthOrdinal:charge.monthOrdinal===null?null:BigInt(charge.monthOrdinal),rateRial:charge.rateRial===null?null:BigInt(charge.rateRial),tariffRevision:tariff.revision}});
  await tx.auditEvent.create({data:{sessionId:scope.sessionId,id:randomUUID(),kind:'outbound-redirect-issued',createdAt:now,payload:json({...rowEvent(event),intentId:receipt.intentId,tariff,policy:{windowMinutes:60,pricing:'graduated',visitorBasis:'visitor-session'}})}});
  return rowEvent(event);
 });}
 setTariff(scope:DataScope,providerId:string,input:UpdateProviderTariff,clock:RealClock){const validated=UpdateProviderTariffSchema.parse(input);return scopedTransaction(this.db,scope,async tx=>{
  const now=clock.now();
  const old=await tx.providerTariff.findUnique({where:{sessionId_providerId:{sessionId:scope.sessionId,providerId}}});
  const previous=old?ProviderTariffSchema.parse(old.payload):defaultTariff(providerId);
  if(previous.revision!==validated.baseRevision)throw new RepositoryError('IDEMPOTENCY_CONFLICT');
  const next=ProviderTariffSchema.parse({providerId,revision:randomUUID(),tiers:validated.tiers,updatedAt:now.toISOString()});
  await tx.providerTariff.upsert({where:{sessionId_providerId:{sessionId:scope.sessionId,providerId}},create:{sessionId:scope.sessionId,providerId,revision:next.revision,payload:json(next),updatedAt:now},update:{revision:next.revision,payload:json(next),updatedAt:now}});
  await tx.auditEvent.create({data:{sessionId:scope.sessionId,id:randomUUID(),kind:'provider-tariff-updated',createdAt:now,payload:json({providerId,previous,next,effective:'future-redirects-only'})}});
  return next;
 });}
 list(scope:DataScope,q:TrafficQuery,providerIds:readonly string[],now:Date){
  let month:ReturnType<typeof persianMonth>;
  try{month=persianMonth(now,q.month);}catch{throw new RepositoryError('INVALID_QUERY');}
  // Date filters intersect the chosen billing month; future bins are never forecast as zero.
  const from=new Date(Math.max(month.from.getTime(),q.from?Date.parse(q.from):-Infinity));
  const to=new Date(Math.min(month.to.getTime(),q.to?Date.parse(q.to):Infinity,now.getTime()+1));
  if(to<=from)throw new RepositoryError('INVALID_QUERY');
  return scopedTransaction(this.db,scope,async tx=>{
   const where=Prisma.sql`WHERE "sessionId"=${scope.sessionId} AND "redirectedAt">=${from} AND "redirectedAt"<${to} ${q.providerId?Prisma.sql`AND "providerId"=${q.providerId}`:Prisma.empty} ${q.kind?Prisma.sql`AND kind=${q.kind}`:Prisma.empty}`;
   const [totalRows,providerRows,dayRows,eventRows,eventTotal,tariffs,progress,months]=await Promise.all([
    tx.$queryRaw<Record<string,unknown>[]>(Prisma.sql`SELECT ${columns} FROM "OutboundReferral" ${where}`),
    tx.$queryRaw<(Record<string,unknown>&{providerId:string;lastOutboundAt:Date})[]>(Prisma.sql`SELECT "providerId",max("redirectedAt") AS "lastOutboundAt",${columns} FROM "OutboundReferral" ${where} GROUP BY "providerId"`),
    tx.$queryRaw<(Record<string,unknown>&{date:string})[]>(Prisma.sql`SELECT ("redirectedAt" AT TIME ZONE 'Asia/Tehran')::date::text AS date,${columns} FROM "OutboundReferral" ${where} GROUP BY 1 ORDER BY 1`),
    tx.outboundReferral.findMany({where:{sessionId:scope.sessionId,redirectedAt:{gte:from,lt:to},...(q.providerId?{providerId:q.providerId}:{}),...(q.kind?{kind:q.kind}:{})},orderBy:[{redirectedAt:'desc'},{referralId:'desc'}],skip:q.offset,take:q.limit}),
    tx.$queryRaw<{total:bigint}[]>(Prisma.sql`SELECT count(*) AS total FROM "OutboundReferral" ${where}`),
    tx.providerTariff.findMany({where:{sessionId:scope.sessionId}}),
    tx.outboundReferral.groupBy({by:['providerId'],where:{sessionId:scope.sessionId,billable:true,monthKey:month.key,redirectedAt:{lt:new Date(now.getTime()+1)}},_count:{_all:true}}),
    tx.outboundReferral.findMany({where:{sessionId:scope.sessionId,redirectedAt:{lt:new Date(now.getTime()+1)}},distinct:['monthKey'],select:{monthKey:true},orderBy:{monthKey:'desc'}})
   ]);
   const ids=q.providerId?[q.providerId]:[...providerIds],providers=ids.map(providerId=>{const row=providerRows.find(x=>x.providerId===providerId),stored=tariffs.find(x=>x.providerId===providerId);return {providerId,counts:counts(row),lastOutboundAt:row?.lastOutboundAt.toISOString()??null,tariff:stored?ProviderTariffSchema.parse(stored.payload):defaultTariff(providerId),billingMonthBillable:progress.find(x=>x.providerId===providerId)?._count._all??0};}).sort((a,b)=>b.counts.outbound-a.counts.outbound||a.providerId.localeCompare(b.providerId));
   return ProviderTrafficSchema.parse({period:{monthKey:month.key,currentMonthKey:persianMonth(now).key,from:from.toISOString(),to:to.toISOString(),timeZone:BILLING_ZONE,calendar:'persian'},policy:{windowMinutes:60,pricing:'graduated',uniqueVisitorBasis:'visitor-session',eventBasis:'redirect-issued'},totals:counts(totalRows[0]),providers,daily:trafficDayKeys(from,to).map(date=>({date,counts:counts(dayRows.find(row=>row.date===date))})),events:{offset:q.offset,limit:q.limit,total:safeTrafficInteger(eventTotal[0]!.total),items:eventRows.map(rowEvent)},availableMonths:[...new Set([persianMonth(now).key,...months.map(x=>x.monthKey)])].sort().reverse()});
  });
 }
}
