import { describe, expect, it } from 'vitest';
import { ApiErrorCodeSchema } from '@torob-ticket/contracts';
import { ClientError } from './api-client';
import { errorPolicy } from './error-policy';
describe('recovery authorization policy', () => {
  it.each(ApiErrorCodeSchema.options)('classifies the actual %s contract without enabling mutation replay', code => {
    const error = new ClientError('api', code, { code, retryable: true, requestId: 'recorded', fieldPaths: [] });
    expect(errorPolicy(error, 'mutation').retryRead).toBe(false);
    expect(errorPolicy(error, 'confirmation').retryRead).toBe(false);
    expect(errorPolicy(error).title.fa).not.toBe('');
    if (['OFFER_UNAVAILABLE', 'INCOMPLETE_PRICE', 'INTENT_EXPIRED', 'QUOTE_EXPIRED'].includes(code)) expect(errorPolicy(error).requiresFreshQuote).toBe(true);
    if (code === 'SESSION_EXPIRED') expect(errorPolicy(error).kind).toBe('expired');
  });
  it('allows safe network reads while requiring deliberate confirmation replay', () => {
    const error = new ClientError('network', 'offline');
    expect(errorPolicy(error, 'read').retryRead).toBe(true);
    expect(errorPolicy(error, 'confirmation').retryRead).toBe(false);
    expect(errorPolicy(new ClientError('schema', 'bad-data')).retryRead).toBe(false);
    expect(errorPolicy(new DOMException('cancelled', 'AbortError')).kind).toBe('aborted');
    expect(errorPolicy({ name: 'AbortError' }).retryRead).toBe(false);
  });
});
