import 'reflect-metadata';
import {randomUUID} from 'node:crypto';
import {Test} from '@nestjs/testing';
import type {INestApplication} from '@nestjs/common';
import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import {ProviderTrafficSchema,ProviderTariffSchema,ReferralReceiptSchema,RecheckResultSchema,SearchRecoverySchema,HotelSearchSnapshotSchema,type ReferralReceipt,type TransportSearchQuery} from '@torob-ticket/contracts';
import {ProviderTrafficRepository,persianMonth,type Prisma} from '@torob-ticket/data-access';
import {AppModule} from '../app.module';
import {trafficVisitorCookieName} from '../sessions/traffic-visitor';
import {SessionService} from '../sessions/session.service';
import {requireTestDatabaseUrl} from '../../test/test-database.cjs';
const query:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-10-25',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
describe('tracked provider redirects and hourly graduated fees',()=>{
 let app:INestApplication,base:string,sessions:SessionService,now:number;const owned:string[]=[];
 const request=(path:string,cookie:string,method='GET',body?:unknown)=>fetch(base+'/api/v1/'+path,{method,redirect:'manual',headers:{cookie,...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 async function create(){const response=await request('demo/session','','POST',{seed:8686,scenario:'normal',anchorInstant:'2026-10-25T06:00:00Z'});expect(response.status).toBe(201);const cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '),context=await sessions.authenticate({headers:{cookie}},{setHeader(){}}),scope=context.scope;if(!context.visitorId)throw Error('Expected server visitor cookie');owned.push(scope.sessionId);return {cookie,scope,visitorId:context.visitorId,authCookie:response.headers.getSetCookie()[0]!.split(';')[0]!};}
 async function accepted(cookie:string){const response=await request('searches',cookie,'POST',{query,clientGeneration:randomUUID()});let search=SearchRecoverySchema.parse(await response.json());await expect.poll(async()=>{search=SearchRecoverySchema.parse(await(await request('searches/'+search.snapshot.searchId,cookie)).json());return search.snapshot.status;},{timeout:8000,interval:25}).not.toBe('collecting');const quote=search.snapshot.groups.flatMap(g=>g.eligibleQuotes)[0]!;const prepared=RecheckResultSchema.parse(await(await request('referrals/prepare',cookie,'POST',{kind:'transport',quoteId:quote.quoteId,quoteVersion:quote.version})).json());if(prepared.status==='unavailable')throw Error('Expected eligible fixture');return ReferralReceiptSchema.parse(await(await request('referrals/confirm',cookie,'POST',{intentId:prepared.intent.intentId,acceptedQuoteVersion:prepared.intent.selection.quoteVersion,idempotencyKey:randomUUID()})).json());}
 async function another(scope:{sessionId:string},original:ReferralReceipt){
  // Controlled accepted-receipt fixtures reuse genuine normalized source evidence;
  // the production issue/aggregate path still produces every redirect/fee row.
  const id=randomUUID(),receipt=ReferralReceiptSchema.parse({...original,referralId:id,handoffPath:'/provider-demo/'+id});
  const payload:Prisma.InputJsonValue=JSON.parse(JSON.stringify(receipt));
  await sessions.database.referralEvent.create({data:{sessionId:scope.sessionId,id,intentId:original.intentId,idempotencyKey:randomUUID(),payloadHash:'owned-integration-fixture',payload,createdAt:new Date(now)}});return receipt;
 }
 beforeAll(async()=>{process.env.DATABASE_URL=requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');base=await app.getUrl();sessions=app.get(SessionService);now=Date.now();vi.spyOn(sessions.realClock,'now').mockImplementation(()=>new Date(now));});
 afterAll(async()=>{vi.restoreAllMocks();if(app){await sessions.database.demoSession.deleteMany({where:{id:{in:owned}}});await app.close();}});
 it('records redirects rather than confirmations, excludesHEAD/crossscope and atomically deduplicates concurrent receipt requests',async()=>{
  const a=await create(),b=await create(),receipt=await accepted(a.cookie),provider=receipt.payload.quote.providerId;
  const read=async(cookie=a.cookie,suffix='')=>ProviderTrafficSchema.parse(await(await request('admin/traffic'+suffix,cookie)).json());
  expect((await read()).totals).toMatchObject({outbound:0,billable:0,uniqueVisitorSessions:0});
  expect((await request('referrals/'+receipt.referralId+'/outbound',a.cookie,'HEAD')).status).toBe(405);
  expect((await request('referrals/'+receipt.referralId+'/outbound',b.cookie)).status).toBe(404);
  expect((await request('referrals/missing/outbound',a.cookie)).status).toBe(404);
  const responses=await Promise.all([request('referrals/'+receipt.referralId+'/outbound',a.cookie),request('referrals/'+receipt.referralId+'/outbound',a.cookie)]);
  for(const response of responses){expect(response.status).toBe(302);expect(response.headers.get('location')).toBe('https://zarei.xyz');expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer');}
  let result=await read();expect(result.totals).toMatchObject({outbound:1,billable:1,repeats:0,uniqueVisitorSessions:1,unpricedBillable:1,knownFeeRial:0});expect(result.events.items[0]).toMatchObject({referralId:receipt.referralId,providerId:provider,rateRial:null,monthOrdinal:1});
  const tariff=result.providers.find(p=>p.providerId===provider)!.tariff;
  const changed=ProviderTariffSchema.parse(await(await request('admin/providers/'+provider+'/tariff',a.cookie,'PATCH',{baseRevision:tariff.revision,tiers:[{upTo:100,rateRial:1000},{upTo:1000,rateRial:2000},{upTo:null,rateRial:3000}]})).json());
  expect(changed.revision).not.toBe(tariff.revision);
  expect((await request('admin/providers/'+provider+'/tariff',a.cookie,'PATCH',{baseRevision:tariff.revision,tiers:changed.tiers})).status).toBe(409);
  const start=now;now=start+3599999;const second=await another(a.scope,receipt);await request('referrals/'+second.referralId+'/outbound',a.cookie);
  now=start+3600000;const third=await another(a.scope,receipt);await request('referrals/'+third.referralId+'/outbound',a.cookie);
  result=await read();expect(result.totals).toMatchObject({outbound:3,billable:2,repeats:1,uniqueVisitorSessions:1,knownFeeRial:1000,unpricedBillable:1});
  expect(result.events.items.find(x=>x.referralId===receipt.referralId)?.rateRial).toBeNull();expect(result.events.items.find(x=>x.referralId===third.referralId)).toMatchObject({monthOrdinal:2,rateRial:1000,tariffRevision:changed.revision});
  // Reopening the same receipt after an hour remains the same event, never a fresh charge.
  now+=3600000;await request('referrals/'+receipt.referralId+'/outbound',a.cookie);expect((await read()).totals.outbound).toBe(3);
  const exact=await read(a.cookie,'?from='+encodeURIComponent(new Date(start+3600000).toISOString())+'&to='+encodeURIComponent(new Date(start+3600001).toISOString())+'&providerId='+provider);expect(exact.totals).toMatchObject({outbound:1,billable:1,knownFeeRial:1000,unpricedBillable:0});expect(exact.events.total).toBe(1);expect(exact.providers[0]!.counts).toEqual(exact.totals);expect(exact.daily.reduce((n,d)=>n+d.counts.outbound,0)).toBe(1);
  expect((await read(b.cookie)).totals.outbound).toBe(0);
  expect((await request('admin/traffic?providerId=missing',a.cookie)).status).toBe(404);
  expect((await request('admin/providers/missing/tariff',a.cookie,'PATCH',{baseRevision:'x',tiers:[{upTo:null,rateRial:null}]})).status).toBe(404);
  expect((await request('admin/traffic?month=0000-01',a.cookie)).status).toBe(400);
 });
 it('serializes two distinct simultaneous redirects into one eligible hourly charge',async()=>{
  const a=await create(),first=await accepted(a.cookie),second=await another(a.scope,first);
  const responses=await Promise.all([request('referrals/'+first.referralId+'/outbound',a.cookie),request('referrals/'+second.referralId+'/outbound',a.cookie)]);responses.forEach(r=>expect(r.status).toBe(302));
  const result=ProviderTrafficSchema.parse(await(await request('admin/traffic',a.cookie)).json());expect(result.totals).toMatchObject({outbound:2,billable:1,repeats:1,uniqueVisitorSessions:1});expect(result.events.items.filter(x=>x.billable).map(x=>x.monthOrdinal)).toEqual([1]);
 });
 it('keeps rolling-hour exclusion across the Persian month boundary and resets only the eligible ordinal',async()=>{
  const a=await create(),receipt=await accepted(a.cookie),repo=new ProviderTrafficRepository(sessions.database),month=persianMonth(new Date(now)),edge=month.to.getTime();
  const one=await repo.issue(a.scope,receipt.referralId,a.visitorId,{now:()=>new Date(edge-60000)});expect(one.monthKey).toBe(month.key);expect(one.monthOrdinal).toBe(1);
  const second=await another(a.scope,receipt),repeat=await repo.issue(a.scope,second.referralId,a.visitorId,{now:()=>new Date(edge)});expect(repeat.billable).toBe(false);expect(repeat.monthKey).not.toBe(month.key);
  const third=await another(a.scope,receipt),next=await repo.issue(a.scope,third.referralId,a.visitorId,{now:()=>new Date(edge+3540000)});expect(next.billable).toBe(true);expect(next.monthOrdinal).toBe(1);expect(next.monthKey).toBe(repeat.monthKey);
 });
 it('tracks actual hotel redirects with the same billing source and coherent transport/hotel filters',async()=>{
  const a=await create();const hotel=HotelSearchSnapshotSchema.parse(await(await request('hotel-searches',a.cookie,'POST',{destinationCityId:'mashhad',checkIn:'2026-10-25',checkOut:'2026-10-26',party:query.party,rooms:1,sort:'cheapest'})).json());const quote=hotel.quotes[0]!;
  const prepared=RecheckResultSchema.parse(await(await request('referrals/prepare',a.cookie,'POST',{kind:'hotel',quoteId:quote.quoteId,quoteVersion:quote.version})).json());if(prepared.status==='unavailable')throw Error('Expected eligible hotelfixture');
  const receipt=ReferralReceiptSchema.parse(await(await request('referrals/confirm',a.cookie,'POST',{intentId:prepared.intent.intentId,acceptedQuoteVersion:prepared.intent.selection.quoteVersion,idempotencyKey:randomUUID()})).json());expect((await request('referrals/'+receipt.referralId+'/outbound',a.cookie)).status).toBe(302);
  const h=ProviderTrafficSchema.parse(await(await request('admin/traffic?kind=hotel',a.cookie)).json()),t=ProviderTrafficSchema.parse(await(await request('admin/traffic?kind=transport',a.cookie)).json());expect(h.totals).toMatchObject({outbound:1,hotel:1,transport:0,billable:1});expect(h.events.items[0]?.kind).toBe('hotel');expect(t.totals.outbound).toBe(0);expect(t.events.total).toBe(0);expect(t.providers.find(p=>p.providerId===quote.providerId)?.billingMonthBillable).toBe(1);
 });

 it('counts separately server-minted browsers inside one workspace and never trusts missing/forged/foreign visitor cookies',async()=>{
  const a=await create(),other=await create(),receipt=await accepted(a.cookie);
  expect((await request('referrals/'+receipt.referralId+'/outbound',a.authCookie)).status).toBe(403);
  const forged=a.authCookie+'; '+trafficVisitorCookieName(a.scope.sessionId)+'=00000000-0000-4000-8000-000000000000.'+'a'.repeat(43);
  expect((await request('referrals/'+receipt.referralId+'/outbound',forged)).status).toBe(403);
  const foreignVisitor=other.cookie.split('; ').find(value=>value.startsWith('torob_traffic_visitor_'))!;
  expect((await request('referrals/'+receipt.referralId+'/outbound',a.authCookie+'; '+foreignVisitor)).status).toBe(403);
  const bootstrap=await request('demo/session',a.authCookie);expect(bootstrap.status).toBe(200);expect(await bootstrap.json()).not.toHaveProperty('trafficVisitorSecret');
  const issued=bootstrap.headers.getSetCookie();expect(issued).toHaveLength(1);expect(issued[0]).not.toMatch(/^torob_demo=/);
  const browserB=a.authCookie+'; '+issued[0]!.split(';')[0],contextB=await sessions.authenticate({headers:{cookie:browserB}},{setHeader(){}});expect(contextB.sessionId).toBe(a.scope.sessionId);expect(contextB.visitorId).toBeDefined();expect(contextB.visitorId===a.visitorId).toBe(false);
  const second=await another(a.scope,receipt),repeat=await another(a.scope,receipt);
  for(const [id,cookie] of [[receipt.referralId,a.cookie],[second.referralId,browserB],[repeat.referralId,a.cookie]])expect((await request('referrals/'+id+'/outbound',cookie!)).status).toBe(302);
  const result=ProviderTrafficSchema.parse(await(await request('admin/traffic',a.cookie)).json());expect(result.totals).toMatchObject({outbound:3,billable:2,repeats:1,uniqueVisitorSessions:2});
  for(const action of ['sign-in','sign-out'])expect((await request('auth/demo/'+action,a.cookie,'POST',{})).status).toBe(201);
  const after=await sessions.authenticate({headers:{cookie:a.cookie}},{setHeader(){}});expect(after.visitorId).toBe(a.visitorId);
  expect((await request('demo/session',a.cookie)).headers.has('set-cookie')).toBe(false);
 });

 it('keeps a new reset workspace visitor when an older explicit-bootstrap cookie is applied late',async()=>{
  const a=await create(),oldBootstrap=await request('demo/session',a.authCookie);expect(oldBootstrap.status).toBe(200);const lateVisitor=oldBootstrap.headers.getSetCookie()[0]!.split(';')[0]!;
  const reset=await request('demo/reset',a.cookie,'POST',{});expect(reset.status).toBe(201);const freshCookie=reset.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '),fresh=await sessions.authenticate({headers:{cookie:freshCookie}},{setHeader(){}});owned.push(fresh.sessionId);
  expect(fresh.sessionId===a.scope.sessionId).toBe(false);expect(fresh.visitorId).toBeDefined();
  const after=await sessions.authenticate({headers:{cookie:freshCookie+'; '+lateVisitor}},{setHeader(){}});expect(after.visitorId).toBe(fresh.visitorId);
  const current=await request('demo/session',freshCookie+'; '+lateVisitor);expect(current.status).toBe(200);expect(current.headers.has('set-cookie')).toBe(false);
  const expired=await request('demo/session',a.cookie);expect(expired.status).toBe(401);expect(expired.headers.has('set-cookie')).toBe(false);
 });

});
