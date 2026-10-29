import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {SearchSnapshotSchema,type SearchSnapshot,type TransportSearchQuery} from '@torob-ticket/contracts';
import {createPrisma,SearchRepository,SessionRepository,type PrismaClient} from '@torob-ticket/data-access';
import {fixtureIdentity} from '@torob-ticket/fixtures';
import {requireTestDatabaseUrl} from '../../test/test-database.cjs';
const query:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-10-30',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const json=(value:unknown)=>JSON.parse(JSON.stringify(value));
let db:PrismaClient;const ids:string[]=[];
beforeAll(async()=>{db=createPrisma(requireTestDatabaseUrl(process.env.TEST_DATABASE_URL));for(let i=0;i<2;i++)ids.push((await new SessionRepository(db,fixtureIdentity).create(randomUUID(),{},new Date())).id);});
afterAll(async()=>{if(db){await db.demoSession.deleteMany({where:{id:{in:ids}}});await db.$disconnect();}});
async function run(){const id=randomUUID(),scope={sessionId:ids[0]!},snapshot=SearchSnapshotSchema.parse({searchId:id,clientGeneration:'snapshot-read',query,status:'collecting',groups:[],providerStatuses:[],coverage:{expectedProviderIds:[],successfulProviderIds:[],failedProviderIds:[],pendingProviderIds:[],complete:false},observedAt:new Date().toISOString()});const repository=new SearchRepository(db);await repository.create(scope,{query:json(query),snapshot:json(snapshot),clientGeneration:snapshot.clientGeneration},new Date(),{id});return{id,scope,snapshot,repository};}
it('returns the same scoped snapshot and cursor without replaying events; replay readers retain their history',async()=>{
 const f=await run();for(let i=0;i<2;i++)await f.repository.project(f.scope,f.id,new Date(),()=>({snapshot:f.snapshot,quotes:[],audit:{}}));
 let eventReads=0;
 const observed=db.$extends({query:{searchEventRecord:{async findMany({args,query}){eventReads++;return query(args);}}}}) as unknown as PrismaClient;
 const repository=new SearchRepository(observed),thin=await repository.readSnapshot(f.scope,f.id);expect(eventReads).toBe(0);
 const full=await repository.read(f.scope,f.id);expect(eventReads).toBe(1);expect(thin).toEqual({snapshot:full.snapshot,sequence:full.sequence});expect(full.events).toHaveLength(2);expect(full.sequence).toBe(2);
 expect((await repository.read(f.scope,f.id,1)).events.map(row=>row.sequence)).toEqual([2]);
 await expect(repository.readSnapshot({sessionId:ids[1]!},f.id)).rejects.toMatchObject({code:'NOT_FOUND'});
 await expect(repository.readSnapshot(f.scope,randomUUID())).rejects.toMatchObject({code:'NOT_FOUND'});
});
it('retains the shared session lock and reads the committed snapshot/cursor together',async()=>{
 const f=await run(),next:SearchSnapshot={...f.snapshot,observedAt:new Date(Date.now()+1000).toISOString()};
 let unlock!:()=>void,entered!:()=>void;const gate=new Promise<void>(resolve=>{unlock=resolve;}),locked=new Promise<void>(resolve=>{entered=resolve;});
 const writer=db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "DemoSession" WHERE id=${f.scope.sessionId} FOR UPDATE`;await tx.searchRun.update({where:{sessionId_id:{sessionId:f.scope.sessionId,id:f.id}},data:{snapshot:json(next)}});await tx.searchEventRecord.create({data:{sessionId:f.scope.sessionId,searchId:f.id,sequence:1,payload:json({type:'snapshot',sequence:1,searchId:f.id,clientGeneration:next.clientGeneration,payload:next}),createdAt:new Date()}});entered();await gate;});
 await locked;let settled=false;const reading=f.repository.readSnapshot(f.scope,f.id).then(value=>{settled=true;return value;});
 try{await new Promise(resolve=>setTimeout(resolve,30));expect(settled).toBe(false);}finally{unlock();}
 await writer;expect(await reading).toEqual({snapshot:next,sequence:1});
});
it('keeps date-evidence and referral-recheck parents outside comparison snapshot authority',async()=>{
 const f=await run();await db.datePriceRun.create({data:{sessionId:f.scope.sessionId,id:f.id,queryKey:randomUUID(),payload:{kind:'date-price-evidence'},createdAt:new Date()}});
 await expect(f.repository.readSnapshot(f.scope,f.id)).rejects.toMatchObject({code:'NOT_FOUND'});
 const hidden=await f.repository.create(f.scope,{query,snapshot:{kind:'referral-recheck'},clientGeneration:'hidden'},new Date());
 await expect(f.repository.readSnapshot(f.scope,hidden.id)).rejects.toMatchObject({code:'NOT_FOUND'});
});
