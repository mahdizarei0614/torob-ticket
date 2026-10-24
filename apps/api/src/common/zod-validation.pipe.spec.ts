import 'reflect-metadata';
import { Body, Controller, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiErrorSchema, SearchRequestSchema } from '@torob-ticket/contracts';
import { ZodValidationPipe } from './zod-validation.pipe';

const validSearchInput = () => ({ mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-24', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' });

// The pipe is installed on real HTTP routes below; no mocked Nest execution.
@Controller('validation-probe')
class ValidationProbe {
  @Post()
  echo(@Body(new ZodValidationPipe(SearchRequestSchema)) input: unknown) { return input; }
  @Post('correlated')
  correlated(@Body(new ZodValidationPipe(SearchRequestSchema, { requestId: () => 'request-context-42' })) input: unknown) { return input; }
}

describe('Zod validation HTTP boundary', () => {
  let app: INestApplication;
  let baseUrl: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [ValidationProbe] }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });
  const send = (body: unknown, suffix = '') => fetch(`${baseUrl}/validation-probe${suffix}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  it('returns the checked and normalized body to its handler', async () => {
    const response = await send({ query: { ...validSearchInput(), filters: { providerIds: [], operatorIds: [] } }, clientGeneration: 'generation-1' });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ query: validSearchInput(), clientGeneration: 'generation-1' });
  });
  it('maps nested issues and unknown command keys to safe field paths', async () => {
    const response = await send({ query: { ...validSearchInput(), party: { adults: 0, children: 0, infants: 0 }, sessionId: 'secret' }, clientGeneration: 'generation-1' });
    expect(response.status).toBe(400);
    const body = ApiErrorSchema.parse(await response.json());
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ code: 'INVALID_QUERY', retryable: false, fieldPaths: [['query', 'party', 'adults'], ['query', 'sessionId']] });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(body)).not.toContain('secret');
  });
  it('generates a fresh fallback ID for each failure on the same reusable pipe', async () => {
    const a = ApiErrorSchema.parse(await (await send({})).json());
    const b = ApiErrorSchema.parse(await (await send({})).json());
    expect(a.requestId).not.toBe(b.requestId);
    expect(a.requestId).toBeTruthy();
  });
  it('retains the caller request correlation and includes return-date issue paths', async () => {
    const response = await send({ query: { ...validSearchInput(), tripType: 'round-trip' }, clientGeneration: 'g1' }, '/correlated');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: 'INVALID_QUERY', fieldPaths: [['query', 'returnDate']], retryable: false, requestId: 'request-context-42' });
  });
});
