import {randomUUID} from 'node:crypto';
import {AdminReferralDetailSchema,AdminReferralListSchema,ReferralIntentSchema,ReferralReceiptSchema,SearchSnapshotSchema,type AdminReferralQuery} from '@torob-ticket/contracts';
import {Prisma,type PrismaClient} from './generated/client';
import {RepositoryError,scopedTransaction,type DataScope} from './scope';
const recheckKinds=['referral-rechecked','hotel-rechecked','referral-cancelled'];
const json=(x:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(x));
const record=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
const audit=(x:{id:string;kind:string;createdAt:Date;payload:unknown})=>({auditId:x.id,kind:x.kind,createdAt:x.createdAt.toISOString(),payload:x.payload});
/** Counts are persisted events. A page refresh or unconfirmed intent is never an outbound click. */
export class AdminReferralRepository{
 constructor(private readonly db:PrismaClient){}
 list(scope:DataScope,q:AdminReferralQuery){return scopedTransaction(this.db,scope,async tx=>{
  const where:Prisma.ReferralEventWhereInput={sessionId:scope.sessionId,AND:[...(q.providerId?[{payload:{path:['payload','quote','providerId'],equals:q.providerId}}]:[]),...(q.kind?[{payload:{path:['selection','kind'],equals:q.kind}}]:[])],...(q.from||q.to?{createdAt:{...(q.from?{gte:new Date(q.from)}:{}),...(q.to?{lte:new Date(q.to)}:{})}}:{})};
  // Derive legacy hotel provider identity through its immutable selected quote;
  // old audit payloads are never rewritten to add fields.
  const join=Prisma.sql`FROM "AuditEvent" a LEFT JOIN "HotelSearchRun" h ON h."sessionId"=a."sessionId" AND h.id=a.payload->>'hotelSearchId' LEFT JOIN "Quote" hq ON hq."sessionId"=h."sessionId" AND hq.id=h.payload#>>'{selection,quoteId}' AND hq.version::text=h.payload#>>'{selection,quoteVersion}'`;
  const filters=Prisma.sql`WHERE a."sessionId"=${scope.sessionId} AND a.kind IN ('referral-rechecked','hotel-rechecked','referral-cancelled') ${q.providerId?Prisma.sql`AND COALESCE(a.payload#>>'{result,intent,quote,quote,providerId}',a.payload#>>'{evidence,providerId}',a.payload->>'providerId',hq.payload->>'providerId')=${q.providerId}`:Prisma.empty} ${q.kind?Prisma.sql`AND (CASE WHEN a.kind='hotel-rechecked' THEN 'hotel' WHEN a.kind='referral-rechecked' THEN 'transport' ELSE a.payload->>'kind' END)=${q.kind}`:Prisma.empty} ${q.from?Prisma.sql`AND a."createdAt">=${new Date(q.from)}`:Prisma.empty} ${q.to?Prisma.sql`AND a."createdAt"<=${new Date(q.to)}`:Prisma.empty}`;
  const [receipts,total,events,eventTotals,prepared,changed,unavailable,confirmed,cancelled,byProvider]=await Promise.all([
   tx.referralEvent.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:q.offset,take:q.limit}),tx.referralEvent.count({where}),tx.$queryRaw<{id:string;kind:string;createdAt:Date;payload:Prisma.JsonValue}[]>(Prisma.sql`SELECT a.id,a.kind,a."createdAt",a.payload ${join} ${filters} ORDER BY a."createdAt" DESC,a.id DESC OFFSET ${q.recheckOffset} LIMIT ${q.limit}`),tx.$queryRaw<{total:number}[]>(Prisma.sql`SELECT count(*)::int AS total ${join} ${filters}`),tx.referralIntent.count({where:{sessionId:scope.sessionId}}),tx.auditEvent.count({where:{sessionId:scope.sessionId,kind:{in:['referral-rechecked','hotel-rechecked']},payload:{path:['result','status'],equals:'changed'}}}),tx.auditEvent.count({where:{sessionId:scope.sessionId,kind:{in:['referral-rechecked','hotel-rechecked']},payload:{path:['result','status'],equals:'unavailable'}}}),tx.referralEvent.count({where:{sessionId:scope.sessionId}}),tx.auditEvent.count({where:{sessionId:scope.sessionId,kind:'referral-cancelled'}}),tx.$queryRaw<{providerId:string;confirmed:number}[]>`SELECT payload #>> '{payload,quote,providerId}' AS "providerId", count(*)::int AS confirmed FROM "ReferralEvent" WHERE "sessionId"=${scope.sessionId} GROUP BY payload #>> '{payload,quote,providerId}' ORDER BY count(*) DESC,1`
  ]);
  return AdminReferralListSchema.parse({metrics:{prepared,changed,unavailable,confirmed,cancelled,byProvider,scope:'all-session-events',conversionReporting:'not-reported'},referrals:{offset:q.offset,limit:q.limit,total,items:receipts.map(x=>ReferralReceiptSchema.parse(x.payload))},rechecks:{offset:q.recheckOffset,limit:q.limit,total:eventTotals[0]!.total,items:events.map(audit)}});
 });}
 detail(scope:DataScope,id:string){return scopedTransaction(this.db,scope,async tx=>{
  const event=await tx.referralEvent.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id}}});
  const receipt=event?ReferralReceiptSchema.parse(event.payload):null;
  let intentRow=await tx.referralIntent.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:receipt?.intentId??id}}});
  let intent=intentRow?ReferralIntentSchema.parse(record(intentRow.payload).intent):null;
  const directAudit=!receipt&&!intent?await tx.auditEvent.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id}}}):null;
  if(!receipt&&!intent&&(!directAudit||!recheckKinds.includes(directAudit.kind)))throw new RepositoryError('NOT_FOUND');
  if(directAudit&&!intent){const data=record(directAudit.payload),result=record(data.result),candidate=record(result.intent);const pointer=typeof data.intentId==='string'?data.intentId:typeof candidate.intentId==='string'?candidate.intentId:undefined;if(pointer){intentRow=await tx.referralIntent.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:pointer}}});intent=intentRow?ReferralIntentSchema.parse(record(intentRow.payload).intent):null;}}
  const quoteId=receipt?.selection.quoteId??intent?.selection.quoteId;
  const original=quoteId?await tx.quote.findUnique({where:{sessionId_id_version:{sessionId:scope.sessionId,id:quoteId,version:1}},include:{offer:true}}):null;
  const selected=quoteId?await tx.quote.findUnique({where:{sessionId_id_version:{sessionId:scope.sessionId,id:quoteId,version:receipt?.selection.quoteVersion??intent!.selection.quoteVersion}},include:{offer:true}}):null;
  const payload=record(directAudit?.payload);const recheckRunId=selected?.offer?.searchId??selected?.hotelSearchId??(typeof payload.searchId==='string'?payload.searchId:typeof payload.hotelSearchId==='string'?payload.hotelSearchId:null);
  let originSearchId=original?.offer?.searchId??original?.hotelSearchId??null;let sourceQuote:unknown=original?.payload??null;
  if(!originSearchId&&recheckRunId){const run=await tx.searchRun.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:recheckRunId}}});const h=await tx.hotelSearchRun.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:recheckRunId}}});const op=record(run?.snapshot??h?.payload);originSearchId=typeof op.originSearchId==='string'?op.originSearchId:typeof op.originHotelSearchId==='string'?op.originHotelSearchId:null;const selection=record(op.selection);if(typeof selection.quoteId==='string'){const originalQuote=await tx.quote.findUnique({where:{sessionId_id_version:{sessionId:scope.sessionId,id:selection.quoteId,version:1}}});sourceQuote=originalQuote?.payload??null;}}
  const source=originSearchId?await tx.searchRun.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id:originSearchId}}}):null;
  const sourceSearch=SearchSnapshotSchema.safeParse(source?.snapshot);
  const ids=[originSearchId,recheckRunId].filter((x):x is string=>!!x);const intentId=intent?.intentId??receipt?.intentId;
  const ew:Prisma.AuditEventWhereInput={sessionId:scope.sessionId};
  ew.OR=[...ids.flatMap(x=>[{payload:{path:['searchId'],equals:x}},{payload:{path:['hotelSearchId'],equals:x}}]),...(intentId?[{payload:{path:['result','intent','intentId'],equals:intentId}},{payload:{path:['intentId'],equals:intentId}}]:[]),...(directAudit?[{id:directAudit.id}]:[])];
  const rw:Prisma.RawRecordWhereInput={sessionId:scope.sessionId,providerRun:{searchId:{in:ids}}};
  const [rawRecords,rawTotal,events,eventTotal]=await Promise.all([tx.rawRecord.findMany({where:rw,orderBy:{id:'asc'},take:100}),tx.rawRecord.count({where:rw}),tx.auditEvent.findMany({where:ew,orderBy:[{createdAt:'asc'},{id:'asc'}],take:100}),tx.auditEvent.count({where:ew})]);
  return AdminReferralDetailSchema.parse({receipt,intent,originSearchId,recheckRunId,sourceSearch:sourceSearch.success?sourceSearch.data:null,sourceQuote,rawRecords:rawRecords.map(x=>({rawRecordId:x.id,sourceNamespace:x.sourceNamespace,payload:x.payload})),rawTotal,events:events.map(audit),eventTotal});
 });}
 cancel(scope:DataScope,id:string,now:Date){return scopedTransaction(this.db,scope,async tx=>{
  const row=await tx.referralIntent.findUnique({where:{sessionId_id:{sessionId:scope.sessionId,id}}});if(!row)throw new RepositoryError('NOT_FOUND');
  if(await tx.referralEvent.count({where:{sessionId:scope.sessionId,intentId:id}}))return {intentId:id,status:'confirmed' as const};
  const old=await tx.auditEvent.findFirst({where:{sessionId:scope.sessionId,kind:'referral-cancelled',payload:{path:['intentId'],equals:id}}});
  const intent=ReferralIntentSchema.parse(record(row.payload).intent);
  if(!old)await tx.auditEvent.create({data:{sessionId:scope.sessionId,id:randomUUID(),kind:'referral-cancelled',createdAt:now,payload:json({intentId:id,kind:intent.selection.kind,providerId:intent.quote.quote.providerId,reason:'traveler-declined'})}});
  return {intentId:id,status:'cancelled' as const};
 });}
}
