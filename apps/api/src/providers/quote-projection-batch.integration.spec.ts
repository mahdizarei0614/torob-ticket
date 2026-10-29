import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {createPrisma,DatePriceRepository,SearchRepository,SessionRepository,type DataScope,type PrismaClient} from '@torob-ticket/data-access';
import {fixtureIdentity} from '@torob-ticket/fixtures';
import {QuoteSnapshotSchema,type QuoteSnapshot,type SearchSnapshot,type TransportSearchQuery} from '@torob-ticket/contracts';
import {requireTestDatabaseUrl} from '../../test/test-database.cjs';
const now=new Date('2026-10-29T12:00:00Z'),coverage={expectedProviderIds:['demo-provider-01'],successfulProviderIds:['demo-provider-01'],failedProviderIds:[],pendingProviderIds:[],complete:true};
const query:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-01',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
let db:PrismaClient;const ids:string[]=[];
beforeAll(()=>{db=createPrisma(requireTestDatabaseUrl(process.env.TEST_DATABASE_URL));});
afterAll(async()=>{if(db){try{if(ids.length)await db.demoSession.deleteMany({where:{id:{in:ids}}});}finally{await db.$disconnect();}}});
function quote(id:string,index=0):QuoteSnapshot{return QuoteSnapshotSchema.parse({quoteId:id,version:1,itineraryId:'supplied-itinerary',fareId:'supplied-fare',providerId:'demo-provider-01',party:query.party,total:{amountRial:20000000+index*1000,currency:'IRR'},breakdown:[{code:'gross',amount:{amountRial:20000000+index*1000,currency:'IRR'},mandatory:true}],completeness:{status:'complete'},eligibility:{status:'eligible'},conditions:{outbound:{classCode:'economy',checkedBaggageKg:{status:'unknown',reason:'not-supplied'},cabinBaggageKg:{status:'unknown',reason:'not-supplied'},refundable:{status:'unknown',reason:'not-supplied'},cancellation:{status:'unknown',reason:'not-supplied'},seatOrBerth:{status:'unknown',reason:'not-supplied'},materialTerms:[]}},observedAt:now.toISOString(),expiresAt:new Date(now.getTime()+600000).toISOString(),sourceRevision:'source-v3-rich-inventory-2026-10-29',mappingRevision:'mapping-v1',fixtureVersion:fixtureIdentity.fixtureVersion,provenance:[{rawRecordId:'source-raw',sourceNamespace:'demo-provider-01/v1',sourceValue:{supplied:true},sourceRevision:'source-v3-rich-inventory-2026-10-29',mappingRevision:'mapping-v1',fixtureVersion:fixtureIdentity.fixtureVersion}]});}
type Candidate={offerId:string;quote:QuoteSnapshot};
async function setup(kind:'search'|'date'){
 const owner=await new SessionRepository(db,fixtureIdentity).create(randomUUID(),{seed:5151,anchorInstant:'2026-10-29T00:00:00Z'},now);ids.push(owner.id);const scope:DataScope={sessionId:owner.id};
 const searches=new SearchRepository(db),dates=new DatePriceRepository(db);let id:string;
 if(kind==='search'){id=randomUUID();const snapshot:SearchSnapshot={searchId:id,query,clientGeneration:'quote-batch',status:'collecting',groups:[],providerStatuses:[{providerId:'demo-provider-01',status:'running',offerCount:0}],coverage:{...coverage,complete:false,pendingProviderIds:['demo-provider-01'],successfulProviderIds:[]},observedAt:now.toISOString()};await searches.create(scope,{query,clientGeneration:'quote-batch',snapshot:JSON.parse(JSON.stringify(snapshot))},now,{id});}
 else id=(await dates.admit(scope,{query,leg:'outbound',dates:[query.departureDate],clientGeneration:'quote-batch'},now,{sourceRevisions:{},policyRevisions:{}})).id;
 const candidates:Candidate[]=Array.from({length:12},(_,index)=>({offerId:randomUUID(),quote:quote(randomUUID(),index)}));
 await db.offerSnapshot.createMany({data:candidates.map(item=>({sessionId:owner.id,id:item.offerId,searchId:id,payload:{supplied:true},createdAt:now}))});
 const project=async(rows:Candidate[],database:PrismaClient=db)=>{
  const references=rows.map(item=>({offerId:item.offerId,quoteId:item.quote.quoteId,version:item.quote.version}));
  if(kind==='search')return new SearchRepository(database).project(scope,id,now,({previous})=>({snapshot:{...previous,providerStatuses:[{providerId:'demo-provider-01',status:'complete',offerCount:12}]},quotes:rows,audit:{quoteReferences:references}}),{providerId:'demo-provider-01',status:'complete',offerCount:12});
  return new DatePriceRepository(database).project(scope,id,now,payload=>{payload.providerEvidence={'demo-provider-01':{status:'success',dates:[{date:query.departureDate,status:'success'}]}};},({payload})=>({snapshot:{...payload.snapshot,cells:[{date:query.departureDate,status:'priced',minimum:rows[0]!.quote.total,quoteIds:rows.map(item=>item.quote.quoteId),offerIds:rows.map(item=>item.offerId),coverage,observedAt:now.toISOString()}]},quotes:rows,audit:{quoteReferences:references}}));
 };
 const state=async()=>({run:await db.searchRun.findUniqueOrThrow({where:{sessionId_id:{sessionId:owner.id,id}}}),date:kind==='date'?await db.datePriceRun.findUniqueOrThrow({where:{sessionId_id:{sessionId:owner.id,id}}}):null,provider:await db.providerRun.findMany({where:{sessionId:owner.id,searchId:id}}),audits:await db.auditEvent.findMany({where:{sessionId:owner.id},orderBy:{id:'asc'}}),events:await db.searchEventRecord.findMany({where:{sessionId:owner.id,searchId:id},orderBy:{sequence:'asc'}})});
 return{scope,id,candidates,project,state};
}
it.each(['search','date'] as const)('%s projection inserts only missing pairs and preserves every existing payload and timestamp',async kind=>{
 const f=await setup(kind);await f.project(f.candidates.slice(0,4));const originals=await db.quote.findMany({where:{sessionId:f.scope.sessionId},orderBy:{id:'asc'}});
 const incoming=structuredClone(f.candidates);for(const item of incoming.slice(0,4)){item.quote.total.amountRial=1;item.quote.observedAt='2026-10-29T13:00:00Z';item.quote.expiresAt='2026-10-29T14:00:00Z';}
 const batches:number[]=[];const observed=db.$extends({query:{quote:{async createMany({args,query}){batches.push(Array.isArray(args.data)?args.data.length:1);return query(args);}}}});
 await f.project(incoming,observed as unknown as PrismaClient);expect(batches).toEqual([8]);expect(await db.quote.count({where:{sessionId:f.scope.sessionId}})).toBe(12);
 for(const original of originals)expect(await db.quote.findUniqueOrThrow({where:{sessionId_id_version:{sessionId:f.scope.sessionId,id:original.id,version:original.version}}})).toEqual(original);
 await f.project(incoming,observed as unknown as PrismaClient);expect(batches).toEqual([8]);
});
it.each(['search','date'] as const)('%s projection retains first-candidate-wins per version without deduping references or mutating input',async kind=>{
 const f=await setup(kind),first=f.candidates[0]!,later=structuredClone(first),nextVersion=structuredClone(first);later.quote.total.amountRial=1;later.quote.observedAt='2026-10-29T13:00:00Z';nextVersion.quote.version=2;nextVersion.quote.total.amountRial=30000000;
 const rows=[first,later,nextVersion],before=JSON.stringify(rows);const result=await f.project(rows);expect(JSON.stringify(rows)).toBe(before);
 expect((await db.quote.findUniqueOrThrow({where:{sessionId_id_version:{sessionId:f.scope.sessionId,id:first.quote.quoteId,version:1}}})).payload).toEqual(first.quote);expect((await db.quote.findUniqueOrThrow({where:{sessionId_id_version:{sessionId:f.scope.sessionId,id:first.quote.quoteId,version:2}}})).payload).toEqual(nextVersion.quote);
 const audit=await db.auditEvent.findFirstOrThrow({where:{sessionId:f.scope.sessionId,kind:kind==='date'?'date-price-projection':'search-projection'}});expect((audit.payload as {quoteReferences:unknown[]}).quoteReferences).toHaveLength(3);
 if('snapshot'in result){const cell=result.snapshot.cells[0];if(cell?.status==='priced')expect(cell.quoteIds).toEqual(rows.map(item=>item.quote.quoteId));}
});
it.each(['search','date'] as const)('%s projection rolls back all ledger/status/audit/snapshot changes on a missing-offer FK conflict',async kind=>{
 const f=await setup(kind),foreign=await setup(kind),rows=structuredClone(f.candidates);rows.at(-1)!.offerId=foreign.candidates[0]!.offerId;const before=await f.state();
 await expect(f.project(rows)).rejects.toThrow();expect(await db.quote.count({where:{sessionId:f.scope.sessionId}})).toBe(0);expect(await f.state()).toEqual(before);expect(await db.quote.count({where:{sessionId:foreign.scope.sessionId}})).toBe(0);
});
it.each(['search','date'] as const)('%s projection rolls back already inserted quote rows when a later audit write fails',async kind=>{
 const f=await setup(kind),before=await f.state();let inserted=false;
 const failing=db.$extends({query:{quote:{async createMany({args,query}){const result=await query(args);inserted=true;return result;}},auditEvent:{async create({args,query}){await query(args);throw new Error('after-audit-write');}}}});
 await expect(f.project(f.candidates,failing as unknown as PrismaClient)).rejects.toThrow('after-audit-write');expect(inserted).toBe(true);expect(await db.quote.count({where:{sessionId:f.scope.sessionId}})).toBe(0);expect(await f.state()).toEqual(before);
});
it('keeps quote identities session-scoped while refusing cross-session offer ownership',async()=>{
 const a=await setup('date'),b=await setup('date');const same=structuredClone(b.candidates[0]!);same.quote.quoteId=a.candidates[0]!.quote.quoteId;await a.project([a.candidates[0]!]);await b.project([same]);
 expect(await db.quote.count({where:{id:same.quote.quoteId}})).toBe(2);const before=await db.quote.findMany({where:{sessionId:a.scope.sessionId}});const bad=structuredClone(b.candidates[1]!);bad.offerId=a.candidates[1]!.offerId;await expect(b.project([bad])).rejects.toThrow();expect(await db.quote.findMany({where:{sessionId:a.scope.sessionId}})).toEqual(before);
});
