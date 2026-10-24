import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';

describe('API liveness contract', () => {
  let app: INestApplication;
  let baseUrl: string;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalDatabaseUrl; });
  it('reports demo API liveness without a database or external service', async () => {
    const response = await fetch(`${baseUrl}/api/health/live`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'ok', service: 'torob-ticket-api', mode: 'demo' });
  });
  it('reports not ready while storage is unconfigured, without affecting liveness', async () => {
    expect((await fetch(`${baseUrl}/api/health/ready`)).status).toBe(503);
    expect((await fetch(`${baseUrl}/api/health/live`)).status).toBe(200);
  });
  it('does not expose the health route outside the API prefix', async () => {
    expect((await fetch(`${baseUrl}/health/live`)).status).toBe(404);
  });
});
