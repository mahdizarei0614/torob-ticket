import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {createPrisma,SessionRepository,SearchRepository,type PrismaClient} from '@torob-ticket/data-access';
import {requireTestDatabaseUrl} from '../../test/test-database.cjs';

// The explicit _test connection guard prevents this cascade/locking test from using the app database.
const cutoff=new Date('1901-01-03T00:00:00Z');
let db:PrismaClient,repo:SessionRepository;
const owned:string[]=[];
const expired:{id:string;hash:string}[]=[];
let live:string;
beforeAll(async()=>{
 db=createPrisma(requireTestDatabaseUrl(process.env.TEST_DATABASE_URL));repo=new SessionRepository(db);
 for(let index=0;index<3;index++){
  const hash=randomUUID(),createdAt=new Date(Date.UTC(1901,0,1,index));
  const row=await repo.create(hash,{seed:45},createdAt);owned.push(row.id);expired.push({id:row.id,hash});
  const search=await new SearchRepository(db).create({sessionId:row.id},{query:{},clientGeneration:randomUUID(),snapshot:{status:'collecting'}},createdAt);
  await db.providerRun.create({data:{sessionId:row.id,searchId:search.id,id:'provider',providerId:'cleanup-provider',status:'complete',payload:{}}});
  await db.rawRecord.createMany({data:Array.from({length:100},(_,i)=>({sessionId:row.id,id:'raw-'+i,providerRunId:'provider',sourceNamespace:'cleanup-provider/v1',fixtureVersion:row.fixtureVersion,observedAt:createdAt,payload:{index:i}}))});
  await db.normalizationDecision.createMany({data:Array.from({length:100},(_,i)=>({sessionId:row.id,id:'trace-'+i,rawRecordId:'raw-'+i,mappingRevision:row.mappingRevision,createdAt,payload:{status:'accepted'}}))});
 }
 const row=await repo.create(randomUUID(),{seed:45},new Date('1901-01-02T12:00:00Z'));owned.push(row.id);live=row.id;
});
afterAll(async()=>{if(db){try{await db.demoSession.deleteMany({where:{id:{in:owned}}});}finally{await db.$disconnect();}}});
it('collects one oldest expired reviewer with its full evidence cascade while retaining the live and remaining expired reviewers',async()=>{
 await expect(repo.resolveAndTouch(expired[0]!.hash,cutoff)).rejects.toMatchObject({code:'SESSION_EXPIRED'});
 const removed=await repo.cleanup(cutoff);expect(removed).toEqual([expired[0]!.id]);
 expect(await db.rawRecord.count({where:{sessionId:expired[0]!.id}})).toBe(0);expect(await db.normalizationDecision.count({where:{sessionId:expired[0]!.id}})).toBe(0);
 expect(await db.demoSession.count({where:{id:{in:expired.slice(1).map(row=>row.id)}}})).toBe(2);expect(await db.demoSession.count({where:{id:live}})).toBe(1);
 expect(await db.normalizationDecision.count({where:{sessionId:expired[1]!.id}})).toBe(100);
});
it('skips a locked expired reviewer without blocking, then makes bounded progress on the next maintenance call',async()=>{
 let release!:()=>void,locked!:()=>void;
 const released=new Promise<void>(resolve=>{release=resolve;}),ready=new Promise<void>(resolve=>{locked=resolve;});
 const owner=db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "DemoSession" WHERE id=${expired[1]!.id} FOR UPDATE`;locked();await released;},{timeout:30000});
 try{
  await Promise.race([ready,owner.then(()=>{throw new Error('Review lock finished before acquisition');})]);
  expect(await repo.cleanup(cutoff)).toEqual([expired[2]!.id]);expect(await db.demoSession.count({where:{id:expired[1]!.id}})).toBe(1);
 }finally{release();await owner;}
 expect(await repo.cleanup(cutoff)).toEqual([expired[1]!.id]);expect(await repo.cleanup(cutoff)).toEqual([]);
 expect(await db.demoSession.count({where:{id:live}})).toBe(1);
});
