import 'reflect-metadata';
import {randomUUID} from 'node:crypto';
import {Test} from '@nestjs/testing';
import type {INestApplication} from '@nestjs/common';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {ProviderTrafficSchema,SessionInfoSchema} from '@torob-ticket/contracts';
import {ReviewerActivityRepository,TRAFFIC_ACTIVITY_MARKER,REVIEWER_ACTIVITY_SETUP,type Prisma,type PrismaClient} from '@torob-ticket/data-access';
import {AppModule} from '../app.module';
import {DirectLoginService} from '../direct-login/direct-login.service';
import {SessionService} from '../sessions/session.service';
import {requireTestDatabaseUrl} from '../../test/test-database.cjs';

describe('Docker reviewer data initialization',()=>{
 let app:INestApplication,base:string,sessions:SessionService,templateId:string;const owned:string[]=[];
 const request=(path:string,cookie='',method='GET',body?:unknown)=>fetch(base+'/api/v1/'+path,{method,headers:{cookie,...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const traffic=async(cookie:string)=>{const r=await request('admin/traffic',cookie);expect(r.status).toBe(200);return ProviderTrafficSchema.parse(await r.json());};
 async function create(){const r=await request('demo/session','','POST',{});expect(r.status).toBe(201);SessionInfoSchema.parse(await r.json());const cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),context=await sessions.authenticate({headers:{cookie}},{setHeader(){}});owned.push(context.sessionId);return {cookie,...context};}
 beforeAll(async()=>{
  vi.stubEnv('DATABASE_URL',requireTestDatabaseUrl(process.env.TEST_DATABASE_URL));vi.stubEnv('TOROBTICKET_REVIEWER_ACTIVITY','true');vi.stubEnv('TOROBTICKET_LOCAL_REVIEW','true');vi.stubEnv('TOROBTICKET_SSO_ORIGIN','http://127.0.0.1:4900');vi.stubEnv('TOROBTICKET_ADMIN_ORIGIN','http://127.0.0.1:4901');vi.stubEnv('TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN','http://localhost:4910');
  const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(DirectLoginService).useValue({}).compile();
  sessions=module.get(SessionService);vi.spyOn(sessions.realClock,'now').mockImplementation(()=>new Date('2026-11-07T08:00:00Z'));
  app=module.createNestApplication();app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');base=await app.getUrl();
  const template=await sessions.database.demoSession.findFirstOrThrow({where:{credentialHash:{startsWith:'internal-activity-template:'}}});templateId=template.id;owned.push(template.id);
 },120000);
 afterAll(async()=>{if(app){await sessions.database.demoSession.deleteMany({where:{id:{in:owned}}});await app.close();}vi.restoreAllMocks();vi.unstubAllEnvs();},120000);
 it('has ready data at startup and gives simultaneous reviewers private populated copies',async()=>{
  expect(await sessions.database.auditEvent.count({where:{sessionId:templateId,id:TRAFFIC_ACTIVITY_MARKER}})).toBe(1);
  // Housekeeping is deliberately outside the history-audit allowlist.
  const privateAudit=randomUUID();await sessions.database.auditEvent.create({data:{sessionId:templateId,id:privateAudit,kind:'template-internal-only',payload:{private:true},createdAt:new Date()}});
  const started=Date.now(),[a,b]=await Promise.all([create(),create()]);expect(a.sessionId).not.toBe(b.sessionId);
  const [one,two]=await Promise.all([traffic(a.cookie),traffic(b.cookie)]);expect(one.totals.outbound).toBeGreaterThan(1000);expect(one.totals).toEqual(two.totals);expect(one.availableMonths).toHaveLength(3);
  for(const viewer of [a,b]){expect(await sessions.database.auditEvent.count({where:{sessionId:viewer.sessionId,id:privateAudit}})).toBe(0);expect(await sessions.database.directLoginClient.count({where:{sessionId:viewer.sessionId}})).toBe(0);expect(await sessions.database.demoIdentity.count({where:{sessionId:viewer.sessionId}})).toBe(0);}
  const tariff=one.providers[0]!.tariff;expect((await request('admin/providers/'+tariff.providerId+'/tariff',a.cookie,'PATCH',{baseRevision:tariff.revision,tiers:[{upTo:null,rateRial:777}]})).status).toBe(200);
  expect((await traffic(b.cookie)).providers.find(p=>p.providerId===tariff.providerId)?.tariff).toEqual(tariff);
  expect(Date.now()-started).toBeLessThan(20000);
 },60000);
 it('withholds credentials if the setup marker fails and a new bootstrap receives complete data',async()=>{
  const begin=vi.spyOn(ReviewerActivityRepository.prototype,'begin').mockImplementationOnce(async scope=>{owned.push(scope.sessionId);throw new Error('setup-marker-unavailable');});
  try{const response=await request('demo/session','','POST',{});expect(response.status).toBe(500);expect(response.headers.getSetCookie()).toEqual([]);}finally{begin.mockRestore();}
  expect((await traffic((await create()).cookie)).totals.outbound).toBeGreaterThan(1000);
 },60000);
 it('does not seed opted-out or existing workspaces, and ordinary reads never do it',async()=>{
  vi.stubEnv('TOROBTICKET_REVIEWER_ACTIVITY','false');const a=await create();expect((await traffic(a.cookie)).totals.outbound).toBe(0);
  vi.stubEnv('TOROBTICKET_REVIEWER_ACTIVITY','true');expect((await request('demo/session',a.cookie,'POST',{})).status).toBe(201);expect((await traffic(a.cookie)).totals.outbound).toBe(0);expect(await sessions.database.auditEvent.count({where:{sessionId:a.sessionId,id:REVIEWER_ACTIVITY_SETUP}})).toBe(0);
  vi.stubEnv('TOROBTICKET_SSO_ORIGIN','https://example.com');const b=await create();expect((await traffic(b.cookie)).totals.outbound).toBe(0);vi.stubEnv('TOROBTICKET_SSO_ORIGIN','http://127.0.0.1:4900');
 });
 // Intercept only this repository's transaction, keeping real PostgreSQL SQL,
 // constraints, locks and rollback while injecting an interrupted copy.
 function copyWithStep(step:()=>Promise<void>){
  const db=new Proxy(sessions.database,{get(target,key){
   if(key==='$transaction')return (work:(tx:Prisma.TransactionClient)=>Promise<unknown>,options?:{maxWait?:number;timeout?:number})=>target.$transaction(tx=>work(new Proxy(tx,{get(client,name){
    const value=Reflect.get(client,name);
    if(name==='$executeRaw')return async(...args:Parameters<Prisma.TransactionClient['$executeRaw']>)=>{const result=await client.$executeRaw(...args);await step();return result;};
    return typeof value==='function'?value.bind(client):value;
   }})),options);
   const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }}) as PrismaClient;
  return new ReviewerActivityRepository(db);
 }
 it('rolls back an interrupted clone and retries without sharing credentials',async()=>{
  vi.stubEnv('TOROBTICKET_REVIEWER_ACTIVITY','false');const a=await create();vi.stubEnv('TOROBTICKET_REVIEWER_ACTIVITY','true');
  const interrupted=copyWithStep(async()=>{throw new Error('interrupted-copy');});
  await expect(interrupted.copy(a.scope,{sessionId:templateId})).rejects.toThrow('interrupted-copy');
  expect(await sessions.database.searchRun.count({where:{sessionId:a.sessionId}})).toBe(0);expect(await sessions.database.outboundReferral.count({where:{sessionId:a.sessionId}})).toBe(0);expect(await sessions.database.auditEvent.count({where:{sessionId:a.sessionId,id:TRAFFIC_ACTIVITY_MARKER}})).toBe(0);
  const repository=new ReviewerActivityRepository(sessions.database);expect((await repository.copy(a.scope,{sessionId:templateId})).status).toBe('loaded');expect((await repository.copy(a.scope,{sessionId:templateId})).status).toBe('already-loaded');
  const target=await sessions.database.demoSession.findUniqueOrThrow({where:{id:a.sessionId}});expect(target.credentialHash).not.toBe((await sessions.database.demoSession.findUniqueOrThrow({where:{id:templateId}})).credentialHash);
 },60000);
 it('resets a populated workspace into another populated scope while isolating its peer',async()=>{
  const a=await create(),b=await create(),before=await traffic(b.cookie),started=Date.now();
  const r=await request('admin/reset',a.cookie,'POST',{});expect(r.status).toBe(201);SessionInfoSchema.parse(await r.json());
  const cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),context=await sessions.authenticate({headers:{cookie}},{setHeader(){}});owned.push(context.sessionId);expect(context.sessionId).not.toBe(a.sessionId);
  expect((await request('admin/traffic',a.cookie)).status).toBe(401);expect((await traffic(cookie)).totals.outbound).toBeGreaterThan(1000);expect(await traffic(b.cookie)).toEqual(before);
  expect(await sessions.database.outboundReferral.count({where:{sessionId:a.sessionId}})).toBe(0);expect(Date.now()-started).toBeLessThan(30000);
  console.info('Populated reset milliseconds:',Date.now()-started);
 },90000);
 it('keeps an expired template locked throughout copying and later collects only its source',async()=>{
  vi.stubEnv('TOROBTICKET_REVIEWER_ACTIVITY','false');const a=await create();vi.stubEnv('TOROBTICKET_REVIEWER_ACTIVITY','true');
  await sessions.database.demoSession.update({where:{id:templateId},data:{expiresAt:new Date(sessions.realClock.now().getTime()-1)}});
  let release!:()=>void,entered!:()=>void,first=true;
  const blocked=new Promise<void>(resolve=>{release=resolve;}),ready=new Promise<void>(resolve=>{entered=resolve;});
  const repository=copyWithStep(async()=>{if(first){first=false;entered();await blocked;}}),copy=repository.copy(a.scope,{sessionId:templateId});
  try{await ready;expect(await sessions.repository.cleanup(sessions.realClock.now())).not.toContain(templateId);expect(await sessions.database.demoSession.count({where:{id:templateId}})).toBe(1);}finally{release();}
  expect((await copy).status).toBe('loaded');const count=await sessions.database.outboundReferral.count({where:{sessionId:a.sessionId}});expect(count).toBe(7908);
  const started=Date.now();expect(await sessions.repository.cleanup(sessions.realClock.now())).toContain(templateId);expect(await sessions.database.outboundReferral.count({where:{sessionId:a.sessionId}})).toBe(count);
  console.info('Template collection milliseconds:',Date.now()-started);
 },90000);
});
