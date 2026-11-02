import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { TransportSearchQuery } from '@torob-ticket/contracts';
import { SearchRepository, SessionRepository, sessionInfo, type DatePricePayload } from '@torob-ticket/data-access';
import { fixtureBundles } from '@torob-ticket/fixtures';
import { requireTestDatabaseUrl } from '../../test/test-database.cjs';
import { FrozenDemoClock } from '../common/clocks';
import { SessionService } from '../sessions/session.service';
import type { SessionContext } from '../sessions/session-context';
import { ProviderService } from '../providers/provider.service';
import { SearchService } from '../searches/search.service';
import { DatePriceService } from '../date-prices/date-price.service';
import { ReferralService } from '../referrals/referral.service';

const query: TransportSearchQuery = { mode:'flight',scope:'domestic',tripType:'round-trip',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-01',returnDate:'2026-11-05',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest' };
let sessions: SessionService, search: SearchService, dates: DatePriceService, referrals: ReferralService, providers: ProviderService;
const owners: SessionContext[] = [], extraReferrals: ReferralService[] = [];
beforeAll(async()=>{
 process.env.DATABASE_URL=requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
 sessions=new SessionService({now:()=>new Date('2026-10-29T10:00:00Z')});await sessions.ensureReady();
 providers=new ProviderService(()=>new SearchRepository(sessions.database),sessions.realClock);
 search=new SearchService(sessions,providers);dates=new DatePriceService(sessions,providers);referrals=new ReferralService(sessions,providers);
});
afterAll(async()=>{
 for(const service of extraReferrals)await service.onModuleDestroy();
 await referrals?.onModuleDestroy();await dates?.onModuleDestroy();await search?.onModuleDestroy();
 if(sessions){await sessions.database.demoSession.deleteMany({where:{id:{in:owners.map(owner=>owner.sessionId)}}});await sessions.onModuleDestroy();}
});

it.each([
 {index:0,version:'showcase-v1',source:'source-v1',policy:'mock-fares-v1'},
 {index:1,version:'showcase-v2',source:'source-v2-travel-research-2026-10-29',policy:'mock-fares-v2'},
 {index:2,version:'showcase-v3',source:'source-v5-schedule-tradeoffs-2026-10-30',policy:'mock-fares-v3'},
])('keeps $version search/date/recheck lineage coherent and confirmations valid after service recreation',async({index,version,source,policy})=>{
 const row=await new SessionRepository(sessions.database,fixtureBundles[index]!.identity).create(randomUUID(),{seed:49,anchorInstant:'2026-10-29T00:00:00Z'},sessions.realClock.now());
 const owner:SessionContext={sessionId:row.id,scope:{sessionId:row.id},info:sessionInfo(row),demoClock:new FrozenDemoClock(row.anchorInstant.toISOString())};owners.push(owner);
 for(const id of ['01','02','03','04','05','06'])await sessions.database.providerOverride.create({data:{sessionId:row.id,providerId:`demo-provider-${id}`,payload:{latencyMs:0}}});
 const started=await search.startSearch(owner,{query,clientGeneration:randomUUID()});
 let completed=(await search.getSearch(owner,started.snapshot.searchId)).snapshot;
 await expect.poll(async()=>{completed=(await search.getSearch(owner,started.snapshot.searchId)).snapshot;return completed.status;},{timeout:5000,interval:10}).toBe('complete');
 const quotes=completed.groups.flatMap(group=>group.eligibleQuotes);expect(quotes.length).toBeGreaterThan(0);
 expect(quotes.every(quote=>quote.provenance.every(item=>item.fixtureVersion===version&&item.sourceRevision===source))).toBe(true);
 const audit=await sessions.database.auditEvent.findFirstOrThrow({where:{sessionId:row.id,kind:'search-context'}});
 const context=(audit.payload as unknown as {context:{policies:Record<string,{revision:string;classCodes:string[]}>}}).context;
 expect(Object.values(context.policies).every(item=>item.revision===policy)).toBe(true);
 expect(context.policies['demo-provider-02']!.classCodes.includes('sleeper-6')).toBe(index>=1);
 const request={query,leg:'outbound' as const,dates:[query.departureDate],clientGeneration:randomUUID()};
 const initial=await dates.startDatePrices(owner,request);
 await expect.poll(async()=>(await dates.getDatePrices(owner,initial.datePriceId,request)).status,{timeout:5000,interval:10}).toBe('complete');
 const price=await sessions.database.datePriceRun.findUniqueOrThrow({where:{sessionId_id:{sessionId:row.id,id:initial.datePriceId}}});
 const stored=price.payload as unknown as DatePricePayload;
 const ids=['01','02','03','04','05','06'].map(id=>`demo-provider-${id}`);
 expect(stored.identity.sourceRevisions).toEqual(Object.fromEntries(ids.map(id=>[id,source])));
 expect(stored.identity.policyRevisions).toEqual(Object.fromEntries(ids.map(id=>[id,policy])));
 const quote=quotes.find(item=>item.providerId==='demo-provider-04')!;
 const prepared=await referrals.prepareReferral(owner,{kind:'transport',quoteId:quote.quoteId,quoteVersion:quote.version});
 expect(prepared.status).toBe('ready');if(prepared.status==='unavailable')throw Error('Expected complete recheck');
 expect(prepared.intent.quote.kind).toBe('transport');
 if(prepared.intent.quote.kind==='transport')expect(prepared.intent.quote.quote.provenance.every(item=>item.sourceRevision===source)).toBe(true);
 // Recreate the consumer of the stored intent; the fingerprint must retain this fixture's revisions.
 const restarted=new ReferralService(sessions,providers);extraReferrals.push(restarted);
 const input={intentId:prepared.intent.intentId,acceptedQuoteVersion:prepared.intent.selection.quoteVersion,idempotencyKey:randomUUID()};
 const receipt=await restarted.confirmReferral(owner,input);
 expect(await restarted.confirmReferral(owner,input)).toEqual(receipt);
 expect(receipt.payload).toEqual(prepared.intent.quote);
 expect((await sessions.database.quote.findUniqueOrThrow({where:{sessionId_id_version:{sessionId:row.id,id:quote.quoteId,version:quote.version}}})).payload).toEqual(quote);
 expect((await sessions.database.demoSession.findUniqueOrThrow({where:{id:row.id}})).fixtureVersion).toBe(version);
});
