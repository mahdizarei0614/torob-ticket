import { requireTestDatabaseUrl } from '../../test/test-database.cjs';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SessionInfoSchema } from '@torob-ticket/contracts';
import { SessionService } from './session.service';
import { AppModule } from '../app.module';

describe('reviewer session HTTP contract with PostgreSQL', () => {
  let app: INestApplication;
  let base: string;
  beforeAll(async () => {
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });
  it('creates a validated reproducible session with an opaque HttpOnly cookie', async () => {
    const response = await fetch(`${base}/api/v1/demo/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({seed: 73, anchorInstant: '2026-10-24T00:00:00.000Z', scenario: 'price-change'}) });
    expect(response.status).toBe(201);
    expect(SessionInfoSchema.parse(await response.json())).toMatchObject({ seed: 73, anchorInstant: '2026-10-24T00:00:00.000Z', scenario: 'price-change' });
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
  });
  it.each([
    ['2026-10-24T00:00:00Z', '2026-10-24T00:00:00.0Z', '2026-10-24T00:00:00.000Z'],
    ['2026-10-24T00:00:00.1Z', '2026-10-24T00:00:00.10Z', '2026-10-24T00:00:00.100Z'],
    ['2026-10-24T00:00:00.123Z', '2026-10-24T00:00:00.123Z', '2026-10-24T00:00:00.123Z'],
  ])('resumes identical and equivalent UTC anchor %s without replacing the sandbox', async (anchorInstant, equivalent, canonical) => {
    const post = (anchor: string, cookie?: string) => fetch(`${base}/api/v1/demo/session`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ seed: 73, anchorInstant: anchor }),
    });
    const created = await post(anchorInstant);
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ anchorInstant: canonical });
    const cookie = created.headers.get('set-cookie')!.split(';')[0]!;
    for (const anchor of [anchorInstant, equivalent, canonical]) {
      const resumed = await post(anchor, cookie);
      expect(resumed.status).toBe(201);
      expect(await resumed.json()).toMatchObject({ anchorInstant: canonical, seed: 73 });
      expect(resumed.headers.has('set-cookie')).toBe(false);
    }
    const different = await post('2026-10-24T00:00:00.124Z', cookie);
    expect(different.status).toBe(409);
    expect(await different.json()).toMatchObject({ code: 'INVALID_QUERY', fieldPaths: [], retryable: false, requestId: expect.any(String) });
  });
  it('rejects sub-millisecond session anchors before persistence', async () => {
    const response = await fetch(`${base}/api/v1/demo/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ anchorInstant: '2026-10-24T00:00:00.0001Z' }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_QUERY', fieldPaths: [['anchorInstant']], retryable: false });
  });
  it('rejects caller-selected session ownership', async () => {
    const response = await fetch(`${base}/api/v1/demo/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({sessionId: 'guessed'}) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({code: 'INVALID_QUERY'});
  });
  it('does not report ready when the required migration is absent', async () => {
    const db = app.get(SessionService).database;
    await db.$executeRaw`UPDATE "_prisma_migrations" SET migration_name = 't04-hidden' WHERE migration_name = '0001_initial'`;
    try {
      expect((await fetch(`${base}/api/health/ready`)).status).toBe(503);
      expect((await fetch(`${base}/api/health/live`)).status).toBe(200);
    } finally { await db.$executeRaw`UPDATE "_prisma_migrations" SET migration_name = '0001_initial' WHERE migration_name = 't04-hidden'`; }
  });
  it('exposes database, migrations and seed readiness independently of liveness', async () => {
    expect((await fetch(`${base}/api/health/live`)).status).toBe(200);
    expect((await fetch(`${base}/api/health/ready`)).status).toBe(200);
  });
});
