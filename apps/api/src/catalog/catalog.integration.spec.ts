import { requireTestDatabaseUrl } from '../../test/test-database.cjs';
import 'reflect-metadata';
import { randomBytes, createHash } from 'node:crypto';
import { SessionRepository } from '@torob-ticket/data-access';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CatalogSnapshotSchema, SessionInfoSchema } from '@torob-ticket/contracts';
import { AppModule } from '../app.module';
import { SessionService } from '../sessions/session.service';

describe('versioned catalog over PostgreSQL and HTTP',()=>{
  let app:INestApplication; let base:string;
  beforeAll(async()=>{process.env.DATABASE_URL=requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');base=await app.getUrl();});
  afterAll(async()=>{await app?.close();});
  async function create(){const response=await fetch(`${base}/api/v1/demo/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({seed:73,anchorInstant:'2026-10-24T00:00:00Z'})});expect(response.status).toBe(201);return {cookie:response.headers.get('set-cookie')!.split(';')[0]!,info:SessionInfoSchema.parse(await response.json())};}
  it('new sessions expose rich inventory matching their immutable fixture root',async()=>{
    const {cookie,info}=await create();expect(info.fixtureVersion).toBe('showcase-v1');
    const response=await fetch(`${base}/api/v1/catalog`,{headers:{cookie}});expect(response.status).toBe(200);
    const catalog=CatalogSnapshotSchema.parse(await response.json());expect(catalog.fixtureVersion).toBe(info.fixtureVersion);expect(catalog.catalogRevision).toBe(info.catalogRevision);expect(catalog.cities).toHaveLength(22);
    const db=app.get(SessionService).database;
    expect(await db.place.count({where:{fixtureVersion:'showcase-v1'}})).toBe(catalog.places.length);
    expect(await db.hotel.count({where:{fixtureVersion:'showcase-v1'}})).toBe(308);
    const rates=await db.roomRate.findMany({where:{fixtureVersion:'showcase-v1'}});expect(rates).toHaveLength(924);
    expect(rates[0]!.payload).toHaveProperty('nightlyTemplate');expect(rates[0]!.payload).not.toHaveProperty('nightlyPrices');
  });
  it('preserves legacy sessions as empty foundation catalogs until explicit reset',async()=>{
    const service=app.get(SessionService), token=randomBytes(32).toString('base64url');
    const legacy=await new SessionRepository(service.database).create(createHash('sha256').update(token).digest('hex'),{seed:91,anchorInstant:'2026-10-24T00:00:00Z'},new Date());
    const cookie=`torob_demo=${token}`;
    const response=await fetch(`${base}/api/v1/catalog`,{headers:{cookie}});expect(response.status).toBe(200);
    expect(CatalogSnapshotSchema.parse(await response.json())).toMatchObject({fixtureVersion:'foundation-v1',catalogRevision:'foundation-catalog-v1',cities:[],supportedConnections:[]});
    expect((await service.database.demoSession.findUniqueOrThrow({where:{id:legacy.id}})).fixtureVersion).toBe('foundation-v1');
    const reset=await fetch(`${base}/api/v1/demo/reset`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:'{}'});expect(reset.status).toBe(201);expect(SessionInfoSchema.parse(await reset.json()).fixtureVersion).toBe('showcase-v1');
    expect((await fetch(`${base}/api/v1/catalog`,{headers:{cookie}})).status).toBe(401);
    expect(await service.database.fixtureVersion.findUnique({where:{id:'foundation-v1'}})).toMatchObject({catalogRevision:'foundation-catalog-v1',manifest:{stage:'foundation',inventory:'authored-in-T05'}});
  });
  it('requires server-derived reviewer identity and rejects a guessed selector',async()=>{
    expect((await fetch(`${base}/api/v1/catalog`)).status).toBe(401);
    const {cookie}=await create();expect((await fetch(`${base}/api/v1/catalog?sessionId=guessed`,{headers:{cookie}})).status).toBe(400);
  });
});
