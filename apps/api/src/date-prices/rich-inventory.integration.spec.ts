import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {DatePriceQuery,TransportSearchQuery} from '@torob-ticket/contracts';
import {SearchRepository,SessionRepository,sessionInfo,type PrismaClient} from '@torob-ticket/data-access';
import {fixtureIdentity} from '@torob-ticket/fixtures';
import {requireTestDatabaseUrl} from '../../test/test-database.cjs';
import {FrozenDemoClock,SystemRealClock} from '../common/clocks';
import {SessionService} from '../sessions/session.service';
import type {SessionContext} from '../sessions/session-context';
import {ProviderService} from '../providers/provider.service';
import {DatePriceService} from './date-price.service';
import {SearchService} from '../searches/search.service';

let sessions:SessionService,dates:DatePriceService,search:SearchService;
const owners:SessionContext[]=[],measurements:unknown[]=[],sqlMeasurements:unknown[]=[];let measurementPhase='setup';
beforeAll(async()=>{
 process.env.DATABASE_URL=requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
 sessions=new SessionService(new SystemRealClock());await sessions.ensureReady();
 if(process.env.RICH_SQL_PROFILE_FILE){
  const observed=sessions.database.$extends({query:{$allOperations:async({model,operation,args,query})=>{
   const started=performance.now();try{return await query(args);}finally{sqlMeasurements.push({phase:measurementPhase,model,operation,milliseconds:performance.now()-started});}
  }}}) as unknown as PrismaClient;
  (sessions as unknown as {db:PrismaClient}).db=observed;
 }
 const providers=new ProviderService(()=>new SearchRepository(sessions.database),sessions.realClock);
 dates=new DatePriceService(sessions,providers);search=new SearchService(sessions,providers);
});
afterAll(async()=>{
 await dates?.onModuleDestroy();await search?.onModuleDestroy();
 if(sessions){await sessions.database.demoSession.deleteMany({where:{id:{in:owners.map(owner=>owner.sessionId)}}});await sessions.onModuleDestroy();}
 if(process.env.RICH_SQL_PROFILE_FILE)writeFileSync(process.env.RICH_SQL_PROFILE_FILE,JSON.stringify(sqlMeasurements,null,2)+'\n');
 if(process.env.RICH_INVENTORY_BENCH_FILE)writeFileSync(process.env.RICH_INVENTORY_BENCH_FILE,JSON.stringify(measurements,null,2)+'\n');
});
const day=(offset:number)=>new Date(Date.UTC(2026,9,29+offset)).toISOString().slice(0,10);
it.each([
 {mode:'flight',scope:'domestic',destinationCityId:'mashhad',classCode:'economy',count:14},
 {mode:'flight',scope:'international',destinationCityId:'los-angeles',classCode:'economy',count:44},
 {mode:'train',scope:'international',destinationCityId:'istanbul',classCode:'sleeper-4',count:44},
] as const)('keeps all $count $mode/$scope calendar dates priced with full provider evidence under the normal deadline',async value=>{
 const row=await new SessionRepository(sessions.database,fixtureIdentity).create(randomUUID(),{seed:49,anchorInstant:'2026-10-29T00:00:00Z'},new Date());
 const owner:SessionContext={sessionId:row.id,scope:{sessionId:row.id},info:sessionInfo(row),demoClock:new FrozenDemoClock(row.anchorInstant.toISOString())};owners.push(owner);
 const query:TransportSearchQuery={mode:value.mode,scope:value.scope,originCityId:'tehran',destinationCityId:value.destinationCityId,tripType:'one-way',departureDate:day(6),party:{adults:1,children:0,infants:0},classCode:value.classCode,filters:{},sort:'cheapest'};
 const request:DatePriceQuery={query,dates:Array.from({length:value.count},(_,offset)=>day(offset)),leg:'outbound',clientGeneration:randomUUID()};
 measurementPhase=value.mode+'/'+value.scope+'/calendar';
 const begin=performance.now(),initial=await dates.startDatePrices(owner,request);let result=initial;
 await expect.poll(async()=>{result=await dates.getDatePrices(owner,initial.datePriceId,request);return result.status;},{timeout:12000,interval:30}).not.toBe('checking');
 const milliseconds=performance.now()-begin;
 const evidence=await sessions.database.rawRecord.count({where:{sessionId:row.id,providerRun:{searchId:initial.datePriceId}}});
 measurements.push({...value,milliseconds,status:result.status,cells:Object.fromEntries([...new Set(result.cells.map(cell=>cell.status))].map(status=>[status,result.cells.filter(cell=>cell.status===status).length])),rawRecords:evidence});
 expect(result.status).toBe('complete');expect(result.cells).toHaveLength(value.count);
 expect(result.cells.every(cell=>cell.status==='priced')).toBe(true);
 expect(evidence).toBe(value.count*12*4);
 for(const cell of result.cells)if(cell.status==='priced'){
  expect(cell.coverage.complete).toBe(true);
  expect([...cell.coverage.successfulProviderIds].sort()).toEqual([...cell.coverage.expectedProviderIds].sort());
  expect(cell.coverage.successfulProviderIds).toHaveLength(4);
  expect(cell.coverage.failedProviderIds).toEqual([]);expect(cell.coverage.pendingProviderIds).toEqual([]);
 }
 measurementPhase=value.mode+'/'+value.scope+'/selected';
 const searchBegin=performance.now(),started=await search.startSearch(owner,{query,clientGeneration:randomUUID()});let snapshot=(await search.getSearch(owner,started.snapshot.searchId)).snapshot;
 await expect.poll(async()=>{snapshot=(await search.getSearch(owner,started.snapshot.searchId)).snapshot;return snapshot.status;},{timeout:10000,interval:30}).not.toBe('collecting');
 measurements.push({kind:'selected-date-search',mode:value.mode,scope:value.scope,milliseconds:performance.now()-searchBegin,status:snapshot.status,providers:snapshot.providerStatuses,rawRecords:await sessions.database.rawRecord.count({where:{sessionId:row.id,providerRun:{searchId:started.snapshot.searchId}}}),groups:snapshot.groups.length,quotes:snapshot.groups.flatMap(group=>group.eligibleQuotes).length});
 expect(snapshot.status).toBe('complete');
 expect(snapshot.groups).toHaveLength(12);expect(snapshot.groups.flatMap(group=>group.eligibleQuotes)).toHaveLength(48);
 const priced=result.cells.find(cell=>cell.date===query.departureDate)!;
 expect(priced.status).toBe('priced');
 if(priced.status==='priced')expect(priced.minimum.amountRial).toBe(Math.min(...snapshot.groups.flatMap(group=>group.eligibleQuotes).map(quote=>quote.total.amountRial)));
},20000);
