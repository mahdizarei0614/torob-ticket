import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';

describe('API liveness contract', () => {
  let app: INestApplication;
  let baseUrl: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });
  it('reports demo API liveness without a database or external service', async () => {
    const response = await fetch(`${baseUrl}/api/health/live`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'ok', service: 'torob-ticket-api', mode: 'demo' });
  });
  it('does not expose the health route outside the API prefix', async () => {
    expect((await fetch(`${baseUrl}/health`)).status).toBe(404);
  });
});
