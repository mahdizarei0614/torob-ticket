import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import type {DatePriceQuery,TransportSearchQuery} from '@torob-ticket/contracts';
import {SearchRepository,SessionRepository,sessionInfo,type ProviderContextSnapshot} from '@torob-ticket/data-access';
import {activeTransportSourceRevision,fixtureIdentity,fixtureSourceRevision} from '@torob-ticket/fixtures';
import {mockRegistry} from '@torob-ticket/provider-adapters';
import {requireTestDatabaseUrl} from '../../test/test-database.cjs';
import {FrozenDemoClock,SystemRealClock} from '../common/clocks';
import {SessionService} from '../sessions/session.service';
import type {SessionContext} from '../sessions/session-context';
import {ProviderService} from '../providers/provider.service';
import {SearchService} from '../searches/search.service';
import {ReferralService} from '../referrals/referral.service';
import {DatePriceService} from './date-price.service';
const base:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'round-trip',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-02',returnDate:'2026-11-07',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const request:DatePriceQuery={query:base,leg:'return',dates:['2026-11-07','2026-11-08','2026-11-09'],clientGeneration:'directional-source'};
const baseSources=Object.fromEntries(mockRegistry.map(adapter=>[adapter.providerId,fixtureSourceRevision('showcase-v3')]));
class OriginalProviderService extends ProviderService {
 override createContext(owner:SessionContext,id:string,signal:AbortSignal,deadline:Date,frozen?:ProviderContextSnapshot){return super.createContext(owner,id,signal,deadline,frozen,baseSources);}
}
describe('source revision upgrade retains the same session and historical PostgreSQL authority',()=>{
 let sessions:SessionService,providers:ProviderService,current:SearchService,original:SearchService,dates:DatePriceService,oldDates:DatePriceService,referrals:ReferralService;
 const owners:SessionContext[]=[];
 async function owner(){
  const row=await new SessionRepository(sessions.database,fixtureIdentity).create(randomUUID(),{seed:6161,anchorInstant:'2026-10-29T00:00:00Z'},new Date());
  const value:SessionContext={sessionId:row.id,scope:{sessionId:row.id},info:sessionInfo(row),demoClock:new FrozenDemoClock(row.anchorInstant.toISOString())};owners.push(value);
  await sessions.database.providerOverride.createMany({data:mockRegistry.map(adapter=>({sessionId:row.id,providerId:adapter.providerId,payload:{latencyMs:0}}))});return value;
 }
 async function completeDates(service:DatePriceService,c:SessionContext,input=request){
  let snapshot=await service.startDatePrices(c,input);
  await expect.poll(async()=>{snapshot=await service.getDatePrices(c,snapshot.datePriceId,input);return snapshot.status;},{timeout:10000,interval:20}).toBe('complete');return snapshot;
 }
 async function completeSearch(service:SearchService,c:SessionContext,query=base){
  let recovery=await service.startSearch(c,{query,clientGeneration:randomUUID()});
  await expect.poll(async()=>{recovery=await service.getSearch(c,recovery.snapshot.searchId);return recovery.snapshot.status;},{timeout:10000,interval:20}).toBe('complete');return recovery;
 }
 beforeAll(async()=>{
  process.env.DATABASE_URL=requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  sessions=new SessionService(new SystemRealClock());await sessions.ensureReady();
  providers=new ProviderService(()=>new SearchRepository(sessions.database),sessions.realClock);
  current=new SearchService(sessions,providers);original=new SearchService(sessions,new OriginalProviderService(()=>new SearchRepository(sessions.database),sessions.realClock));
  dates=new DatePriceService(sessions,providers);oldDates=new DatePriceService(sessions,providers,mockRegistry,fixtureSourceRevision);
  referrals=new ReferralService(sessions,providers);
 });
 afterAll(async()=>{
  for(const service of [referrals,dates,oldDates,current,original])await service?.onModuleDestroy();
  if(sessions){await sessions.database.demoSession.deleteMany({where:{id:{in:owners.map(row=>row.sessionId)}}});await sessions.onModuleDestroy();}
 });
 it('new-source date runs bypass a completed old cache in the same owner and match each selected-date result',async()=>{
  const c=await owner();const before=structuredClone(c.info);
  const old=await completeDates(oldDates,c);
  const oldRow=await sessions.database.datePriceRun.findUniqueOrThrow({where:{sessionId_id:{sessionId:c.sessionId,id:old.datePriceId}}});
  const oldBytes=JSON.stringify(oldRow.payload);
  const fresh=await completeDates(dates,c);
  expect(fresh.datePriceId).not.toBe(old.datePriceId);
  expect((await completeDates(dates,c,{...request,clientGeneration:'matching-new-owner-view'})).datePriceId).toBe(fresh.datePriceId);
  const stored=await sessions.database.datePriceRun.findUniqueOrThrow({where:{sessionId_id:{sessionId:c.sessionId,id:fresh.datePriceId}}});
  expect(stored.payload).toMatchObject({identity:{sourceRevisions:{'demo-provider-01':activeTransportSourceRevision(fixtureIdentity.fixtureVersion)}}});
  const minima:number[]=[];
  for(const cell of fresh.cells){
   expect(cell.status).toBe('priced');if(cell.status!=='priced')throw Error('Expected complete source price');
   const result=await completeSearch(current,c,{...base,returnDate:cell.date,sort:'fastest'});
   const quotes=result.snapshot.groups.flatMap(group=>group.eligibleQuotes);
   expect(quotes.length).toBeGreaterThan(0);expect(quotes.every(quote=>quote.sourceRevision===activeTransportSourceRevision(fixtureIdentity.fixtureVersion))).toBe(true);
   expect(Math.min(...quotes.map(quote=>quote.total.amountRial))).toBe(cell.minimum.amountRial);minima.push(cell.minimum.amountRial);
  }
  expect(new Set(minima).size).toBeGreaterThan(1);
  expect(c.info).toEqual(before);
  expect((await sessions.database.demoSession.findUniqueOrThrow({where:{id:c.sessionId}})).fixtureVersion).toBe('showcase-v3');
  expect(JSON.stringify((await sessions.database.datePriceRun.findUniqueOrThrow({where:{sessionId_id:{sessionId:c.sessionId,id:old.datePriceId}}})).payload)).toBe(oldBytes);
  expect((await dates.getDatePrices(c,old.datePriceId,request)).cells).toEqual(old.cells);
 },30000);
 it('old search GET, exact selected-source recheck and immutable receipt survive new active inventory in that session',async()=>{
  const c=await owner();const historic=await completeSearch(original,c);
  const oldSnapshot=JSON.stringify(historic.snapshot);
  const oldQuote=historic.snapshot.groups[0]!.eligibleQuotes[0]!;expect(oldQuote.sourceRevision).toBe(fixtureSourceRevision('showcase-v3'));
  const quoteBytes=JSON.stringify((await sessions.database.quote.findUniqueOrThrow({where:{sessionId_id_version:{sessionId:c.sessionId,id:oldQuote.quoteId,version:oldQuote.version}}})).payload);
  const modern=await completeSearch(current,c);expect(modern.snapshot.groups.flatMap(group=>group.eligibleQuotes).every(quote=>quote.sourceRevision===activeTransportSourceRevision(fixtureIdentity.fixtureVersion))).toBe(true);
  const prepared=await referrals.prepareReferral(c,{kind:'transport',quoteId:oldQuote.quoteId,quoteVersion:oldQuote.version});
  expect(prepared.status).toBe('ready');if(prepared.status!=='ready')throw Error('Expected unchanged historical source');
  expect(prepared.intent.quote.quote.sourceRevision).toBe(fixtureSourceRevision('showcase-v3'));
  expect(prepared.intent.quote.quote.total).toEqual(oldQuote.total);
  const input={intentId:prepared.intent.intentId,acceptedQuoteVersion:prepared.intent.selection.quoteVersion,idempotencyKey:randomUUID()};
  const receipt=await referrals.confirmReferral(c,input);
  await completeDates(dates,c);
  expect(await referrals.getReferral(c,receipt.referralId)).toEqual(receipt);
  expect(await referrals.confirmReferral(c,input)).toEqual(receipt);
  expect(JSON.stringify((await current.getSearch(c,historic.snapshot.searchId)).snapshot)).toBe(oldSnapshot);
  expect(JSON.stringify((await sessions.database.quote.findUniqueOrThrow({where:{sessionId_id_version:{sessionId:c.sessionId,id:oldQuote.quoteId,version:oldQuote.version}}})).payload)).toBe(quoteBytes);
  const next=await referrals.prepareReferral(c,receipt.selection);expect(next.status).toBe('ready');if(next.status!=='ready')throw Error('Expected next unchanged historical source');
  expect(next.intent.quote.quote.total).toEqual(oldQuote.total);expect(next.intent.quote.quote.sourceRevision).toBe(fixtureSourceRevision('showcase-v3'));
 },30000);
});
