import 'reflect-metadata';
import {randomUUID} from 'node:crypto';
import {Test} from '@nestjs/testing';
import type {INestApplication} from '@nestjs/common';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {AdminProviderHealthSchema,AdminReferralDetailSchema,AdminSearchInspectionSchema,HotelSearchSnapshotSchema,PopulateTrafficSchema,ProviderTrafficSchema,RecheckResultSchema,ReferralReceiptSchema,SearchRecoverySchema,type ProviderTraffic} from '@torob-ticket/contracts';
import {ProviderTrafficRepository,TrafficActivityRepository,TRAFFIC_ACTIVITY_MARKER,persianMonth,trafficActivityPlan,type TrafficActivityPlan} from '@torob-ticket/data-access';
import {catalogForIdentity} from '@torob-ticket/fixtures';
import {AppModule} from '../app.module';
import {SessionService} from '../sessions/session.service';
import {trafficActivitySources} from './traffic-activity-sources';
import {requireTestDatabaseUrl} from '../../test/test-database.cjs';

describe('explicit scoped referral activity import',()=>{
 let app:INestApplication,base:string,sessions:SessionService;const owned:string[]=[];
 const request=(path:string,cookie:string,method='GET',body?:unknown)=>fetch(base+'/api/v1/'+path,{method,redirect:'manual',headers:{cookie,...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 async function create(){
  const response=await request('demo/session','','POST',{});expect(response.status).toBe(201);
  const cookie=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; '),context=await sessions.authenticate({headers:{cookie}},{setHeader(){}});
  owned.push(context.sessionId);return {cookie,...context};
 }
 const read=async(cookie:string,query='')=>{const response=await request('admin/traffic'+query,cookie);expect(response.status).toBe(200);return ProviderTrafficSchema.parse(await response.json());};
 async function accepted(context:Awaited<ReturnType<typeof create>>){
  const date=new Date(context.info.anchorInstant);date.setUTCDate(date.getUTCDate()+3);
  const started=await request('searches',context.cookie,'POST',{query:{mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:date.toISOString().slice(0,10),party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'},clientGeneration:randomUUID()});expect(started.status).toBe(201);
  let recovery=SearchRecoverySchema.parse(await started.json());
  await expect.poll(async()=>{recovery=SearchRecoverySchema.parse(await(await request('searches/'+recovery.snapshot.searchId,context.cookie)).json());return recovery.snapshot.status;},{timeout:10000,interval:25}).toBe('complete');
  const quote=recovery.snapshot.groups.flatMap(g=>g.eligibleQuotes)[0]!;
  const checked=RecheckResultSchema.parse(await(await request('referrals/prepare',context.cookie,'POST',{kind:'transport',quoteId:quote.quoteId,quoteVersion:quote.version})).json());if(checked.status==='unavailable')throw Error('Expected eligible source');
  const receipt=ReferralReceiptSchema.parse(await(await request('referrals/confirm',context.cookie,'POST',{intentId:checked.intent.intentId,acceptedQuoteVersion:checked.intent.selection.quoteVersion,idempotencyKey:randomUUID()})).json());
  return {receipt,snapshot:recovery.snapshot};
 }
 async function prepared(context:Awaited<ReturnType<typeof create>>,limit?:number){
  const catalog=catalogForIdentity(context.info.fixtureVersion,context.info.catalogRevision),full=trafficActivityPlan(sessions.realClock.now(),catalog.providerCapabilities);
  const plan:TrafficActivityPlan={...full,visits:limit?full.visits.slice(0,limit):full.visits};
  return {plan,sources:await trafficActivitySources(plan,catalog,context.info.mappingRevision),identity:{fixtureVersion:context.info.fixtureVersion,mappingRevision:context.info.mappingRevision}};
 }
 beforeAll(async()=>{
  process.env.DATABASE_URL=requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');
  base=await app.getUrl();sessions=app.get(SessionService);vi.spyOn(sessions.realClock,'now').mockImplementation(()=>new Date('2026-11-07T08:00:00Z'));
 });
 afterAll(async()=>{vi.restoreAllMocks();if(app){await sessions.database.demoSession.deleteMany({where:{id:{in:owned}}});await app.close();}},30000);
 it('keeps provider health and transport/hotel referral source inspection readable and scoped',async()=>{
  const a=await create(),peer=await create(),data=await prepared(a,12),repository=new TrafficActivityRepository(sessions.database);
  await repository.populate(a.scope,data.plan,data.sources,data.identity);
  const health=await request('admin/providers',a.cookie);expect(health.status).toBe(200);AdminProviderHealthSchema.parse(await health.json());
  for(const kind of ['transport','hotel'] as const){
   const visit=data.plan.visits.find(v=>v.kind===kind)!;expect(visit).toBeTruthy();
   const response=await request('admin/referrals/'+visit.id,a.cookie);expect(response.status).toBe(200);
   const detail=AdminReferralDetailSchema.parse(await response.json());expect(detail.receipt?.referralId).toBe(visit.id);expect(detail.intent).not.toBeNull();expect(detail.originSearchId).not.toBeNull();expect(detail.sourceQuote).not.toBeNull();
   expect((await request('admin/referrals/'+visit.id,peer.cookie)).status).toBe(404);
   if(kind==='transport'){
    expect(detail.sourceSearch?.searchId).toBe(detail.originSearchId);expect(detail.rawTotal).toBeGreaterThan(0);
    for(const section of ['raw','normalizations','offers','quotes']){
     const inspection=await request(`admin/searches/${detail.originSearchId}?section=${section}`,a.cookie);expect(inspection.status).toBe(200);
     const parsed=AdminSearchInspectionSchema.parse(await inspection.json());expect(parsed.evidence.total).toBeGreaterThan(0);
    }
   }else{
    const hotel=await request('hotel-searches/'+detail.originSearchId,a.cookie);expect(hotel.status).toBe(200);
    const snapshot=HotelSearchSnapshotSchema.parse(await hotel.json());expect(snapshot.quotes[0]?.quoteId).toBe(detail.receipt?.selection.quoteId);
    expect((await request('hotel-searches/'+detail.originSearchId,peer.cookie)).status).toBe(404);
   }
  }
  expect((await read(peer.cookie)).totals.outbound).toBe(0);
 });
 it('atomically loads once under concurrent HTTP requests with coherent monthly, provider, daily and type totals',async()=>{
  const a=await create(),peer=await create(),preserved=await accepted(a);expect((await read(a.cookie)).totals.outbound).toBe(0);expect((await read(a.cookie)).totals.outbound).toBe(0);
  expect(await sessions.database.auditEvent.count({where:{sessionId:a.sessionId,id:TRAFFIC_ACTIVITY_MARKER}})).toBe(0);
  const responses=await Promise.all([request('admin/traffic/populate',a.cookie,'POST',{}),request('admin/traffic/populate',a.cookie,'POST',{})]);
  for(const r of responses)expect(r.status).toBe(201);
  const results=await Promise.all(responses.map(async r=>PopulateTrafficSchema.parse(await r.json())));
  expect(results.map(r=>r.status).sort()).toEqual(['already-loaded','loaded']);const summary=results[0]!;
  expect(summary.providerCount).toBe(6);expect(summary.monthKeys).toHaveLength(3);expect(summary.outbound).toBe(summary.billable+summary.repeats);
  const sumKeys=['outbound','billable','repeats','knownFeeRial','unpricedBillable','transport','hotel'] as const;
  const totals:ProviderTraffic['totals'][]=[];
  for(const month of summary.monthKeys){
   const all=await read(a.cookie,'?month='+month),hotel=await read(a.cookie,'?month='+month+'&kind=hotel'),transport=await read(a.cookie,'?month='+month+'&kind=transport');totals.push(all.totals);
   for(const key of sumKeys){
    expect(all.daily.reduce((n,d)=>n+d.counts[key],0)).toBe(all.totals[key]);expect(all.providers.reduce((n,p)=>n+p.counts[key],0)).toBe(all.totals[key]);
    expect(hotel.totals[key]+transport.totals[key]).toBe(all.totals[key]);
   }
   expect(all.events.total).toBe(all.totals.outbound);
   expect(all.totals.uniqueVisitorSessions).toBeLessThan(all.providers.reduce((n,p)=>n+p.counts.uniqueVisitorSessions,0));
   const provider=all.providers[0]!,filtered=await read(a.cookie,'?month='+month+'&providerId='+provider.providerId);expect(filtered.totals).toEqual(provider.counts);
  }
  expect(totals.reduce((n,t)=>n+t.outbound,0)).toBe(summary.outbound);expect(totals.reduce((n,t)=>n+t.billable,0)).toBe(summary.billable);
  expect(totals[0]!.unpricedBillable).toBeGreaterThan(0);
  const rows=await sessions.database.outboundReferral.findMany({where:{sessionId:a.sessionId,billable:true},orderBy:[{redirectedAt:'asc'},{referralId:'asc'}]});
  const ordinal=new Map<string,number>(),last=new Map<string,number>();
  for(const row of rows){const key=row.providerId+':'+row.monthKey,visitor=row.providerId+':'+row.visitorKey,n=(ordinal.get(key)??0)+1;expect(row.monthOrdinal).toBe(BigInt(n));const prior=last.get(visitor);if(prior!==undefined)expect(row.redirectedAt.getTime()-prior).toBeGreaterThanOrEqual(3600000);ordinal.set(key,n);last.set(visitor,row.redirectedAt.getTime());}
  expect(rows.some(r=>r.monthOrdinal!>1000n&&r.tierIndex===2)).toBe(true);
  const before=await read(a.cookie),again=await request('admin/traffic/populate',a.cookie,'POST',{});expect(PopulateTrafficSchema.parse(await again.json()).status).toBe('already-loaded');expect(await read(a.cookie)).toEqual(before);
  const inspection=await request('admin/referrals/'+preserved.receipt.referralId,a.cookie);expect(inspection.status).toBe(200);const kept=AdminReferralDetailSchema.parse(await inspection.json());expect(kept.receipt).toEqual(preserved.receipt);
  const imported=before.events.items.find(e=>e.kind==='transport')!;const trail=AdminReferralDetailSchema.parse(await(await request('admin/referrals/'+imported.referralId,a.cookie)).json());
  for(const id of [preserved.snapshot.searchId,trail.originSearchId!])for(const section of ['raw','normalizations','offers','quotes']){
   const response=await request(`admin/searches/${id}?section=${section}`,a.cookie);expect(response.status).toBe(200);expect(AdminSearchInspectionSchema.parse(await response.json()).evidence.total).toBeGreaterThan(0);
  }
  const health=await request('admin/providers',a.cookie);expect(health.status).toBe(200);expect(AdminProviderHealthSchema.parse(await health.json()).providers.reduce((n,p)=>n+p.totalRuns,0)).toBeGreaterThan(1000);
  const search=SearchRecoverySchema.parse(await(await request('searches/'+preserved.snapshot.searchId,a.cookie)).json());expect(search.snapshot).toEqual(preserved.snapshot);
  const source=before.providers.find(p=>p.providerId===preserved.receipt.payload.quote.providerId)!,outbound=await request('referrals/'+preserved.receipt.referralId+'/outbound',a.cookie);expect(outbound.status).toBe(302);
  const after=await read(a.cookie),event=after.events.items.find(e=>e.referralId===preserved.receipt.referralId)!;expect(event.billable).toBe(true);expect(event.monthOrdinal).toBe(source.billingMonthBillable+1);expect(after.totals.outbound).toBe(before.totals.outbound+1);
  const retained=await sessions.database.outboundReferral.findMany({where:{sessionId:a.sessionId,billable:true,referralId:{not:preserved.receipt.referralId}},orderBy:[{redirectedAt:'asc'},{referralId:'asc'}]});expect(retained).toEqual(rows);
  expect((await read(peer.cookie)).totals.outbound).toBe(0);
 },180000);
 it.each(['tariff','outbound'] as const)('refuses existing %s without changing it or creating partial history',async kind=>{
  const a=await create(),overview=await read(a.cookie),tariff=overview.providers[0]!.tariff;
  if(kind==='tariff'){const patch=await request('admin/providers/'+tariff.providerId+'/tariff',a.cookie,'PATCH',{baseRevision:tariff.revision,tiers:[{upTo:null,rateRial:1234}]});expect(patch.status).toBe(200);}
  else {const source=await accepted(a);expect((await request('referrals/'+source.receipt.referralId+'/outbound',a.cookie)).status).toBe(302);}
  const before=await read(a.cookie),response=await request('admin/traffic/populate',a.cookie,'POST',{});expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'TRAFFIC_HISTORY_CONFLICT'});
  expect(await read(a.cookie)).toEqual(before);expect(await sessions.database.referralEvent.count({where:{sessionId:a.sessionId}})).toBe(kind==='tariff'?0:1);expect(await sessions.database.auditEvent.count({where:{sessionId:a.sessionId,id:TRAFFIC_ACTIVITY_MARKER}})).toBe(0);
 },120000);
 it('rolls back source inserts and the marker after a late collision, then permits a valid retry',async()=>{
  const a=await create(),data=await prepared(a,12),repository=new TrafficActivityRepository(sessions.database),invalid={...data.plan,visits:[...data.plan.visits,data.plan.visits[0]!]};
  await expect(repository.populate(a.scope,invalid,data.sources,data.identity)).rejects.toMatchObject({code:'P2002'});
  const where={sessionId:a.sessionId};
  const counts=await Promise.all([sessions.database.searchRun.count({where}),sessions.database.hotelSearchRun.count({where}),sessions.database.quote.count({where}),sessions.database.referralIntent.count({where}),sessions.database.referralEvent.count({where}),sessions.database.outboundReferral.count({where}),sessions.database.providerTariff.count({where}),sessions.database.auditEvent.count({where})]);expect(counts).toEqual(Array(8).fill(0));
  expect((await repository.populate(a.scope,data.plan,data.sources,data.identity)).status).toBe('loaded');expect((await repository.existing(a.scope))?.status).toBe('already-loaded');
 });
 it('serializes a tariff/import race into one winner and preserves the winning state',async()=>{
  const a=await create(),data=await prepared(a,12),tariff=(await read(a.cookie)).providers[0]!.tariff;
  const outcomes=await Promise.allSettled([new TrafficActivityRepository(sessions.database).populate(a.scope,data.plan,data.sources,data.identity),new ProviderTrafficRepository(sessions.database).setTariff(a.scope,tariff.providerId,{baseRevision:tariff.revision,tiers:[{upTo:null,rateRial:777}]},sessions.realClock)]);
  expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);const overview=await read(a.cookie);
  if(outcomes[0]!.status==='fulfilled'){expect(overview.providers.find(p=>p.providerId===tariff.providerId)?.tariff.tiers[0]?.rateRial).not.toBe(777);expect(await sessions.database.outboundReferral.count({where:{sessionId:a.sessionId}})).toBe(12);}
  else {expect(overview.providers.find(p=>p.providerId===tariff.providerId)?.tariff.tiers).toEqual([{upTo:null,rateRial:777}]);expect(await sessions.database.searchRun.count({where:{sessionId:a.sessionId}})).toBe(0);expect(await sessions.database.auditEvent.count({where:{sessionId:a.sessionId,id:TRAFFIC_ACTIVITY_MARKER}})).toBe(0);}
 });
 it('bounds intent chronology and two-minute expiry at the first second of a Persian month',async()=>{
  const a=await create(),catalog=catalogForIdentity(a.info.fixtureVersion,a.info.catalogRevision),at=new Date(persianMonth(sessions.realClock.now()).from.getTime()+1001),full=trafficActivityPlan(at,catalog.providerCapabilities);
  const plan={...full,visits:full.visits.filter(v=>v.monthKey===persianMonth(at).key).slice(0,12)};expect(plan.visits).toHaveLength(12);
  const sources=await trafficActivitySources(plan,catalog,a.info.mappingRevision);await new TrafficActivityRepository(sessions.database).populate(a.scope,plan,sources,{fixtureVersion:a.info.fixtureVersion,mappingRevision:a.info.mappingRevision});
  const intents=await sessions.database.referralIntent.findMany({where:{sessionId:a.sessionId},include:{quote:true}});
  for(const intent of intents){expect(intent.createdAt.getTime()).toBeGreaterThanOrEqual(intent.quote.observedAt.getTime());expect(intent.expiresAt.getTime()-intent.createdAt.getTime()).toBeLessThanOrEqual(120000);}
 });
});
