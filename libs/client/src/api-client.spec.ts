import { describe, expect, it, vi } from 'vitest';
import { createApiClient, ClientError } from './api-client';
const session = { seed: 1, anchorInstant: '2026-10-25T00:00:00Z', scenario: 'normal', fixtureVersion: 'f', catalogRevision: 'c', mappingRevision: 'm', scenarioRevision: 's', expiresAt: '2026-10-26T00:00:00Z', identity: null };
const catalog = { fixtureVersion: 'f', catalogRevision: 'c', cities: [], places: [], supportedConnections: [], classChoices: [], providerCapabilities: [] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
describe('same origin runtime validated API client', () => {
  it('single-flights session cookies under concurrent StrictMode bootstrap and validates response', async () => {
    const transport = vi.fn(async () => json(session, 201));
    const client = createApiClient(transport);
    await Promise.all([client.session(), client.session()]);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0]).toMatchObject(['/api/v1/demo/session', { method: 'POST', credentials: 'same-origin', body: '{}' }]);
  });
  it('distinguishes stable API, network and schema failures and never replays a mutation', async () => {
    const error = { code: 'SESSION_EXPIRED', fieldPaths: [], retryable: true, requestId: 'r' };
    const transport = vi.fn(async () => json(error, 401));
    const client = createApiClient(transport);
    await expect(client.reset()).rejects.toMatchObject({ kind: 'api', api: error });
    expect(transport).toHaveBeenCalledTimes(1);
    await expect(createApiClient(async () => { throw new TypeError('offline'); }).session()).rejects.toMatchObject({ kind: 'network' });
    await expect(createApiClient(async () => json({ seed: 1 })).session()).rejects.toMatchObject({ kind: 'schema' });
    expect(new ClientError('schema', 'response').kind).toBe('schema');
  });
  it('bounds read expiry recovery to one bootstrap and one retry', async () => {
    const transport = vi.fn().mockResolvedValueOnce(json({ code: 'SESSION_EXPIRED', fieldPaths: [], retryable: true, requestId: 'r' }, 401)).mockResolvedValueOnce(json(session, 201)).mockResolvedValueOnce(json(catalog));
    await expect(createApiClient(transport).catalog()).resolves.toEqual(catalog);
    expect(transport.mock.calls.map(call => call[0])).toEqual(['/api/v1/catalog', '/api/v1/demo/session', '/api/v1/catalog']);
  });
  it('validates before network, forbids external IDs, and forwards cancellation', async () => {
    const transport = vi.fn(async () => json(catalog));
    const client = createApiClient(transport);
    await expect(client.startSearch({ query: {} } as never)).rejects.toMatchObject({ kind: 'request' });
    expect(transport).not.toHaveBeenCalled();
    const controller = new AbortController();
    await client.catalog(controller.signal);
    expect(transport.mock.calls[0]).toMatchObject(['/api/v1/catalog', { signal: controller.signal, credentials: 'same-origin' }]);
  });
});
describe('abort and bounded recovery boundaries', () => {
  it('preserves aborted response body reads as aborts', async () => {
    const controller = new AbortController();
    const abort = new DOMException('Aborted', 'AbortError');
    const client = createApiClient(async () => ({ ok: true, status: 200, json: async () => { controller.abort(); throw abort; } }) as Response);
    await expect(client.catalog(controller.signal)).rejects.toBe(abort);
  });
  it('never loops when the recovered session still expires', async () => {
    const error = { code: 'SESSION_EXPIRED', fieldPaths: [], retryable: true, requestId: 'r' };
    const transport = vi.fn().mockResolvedValueOnce(json(error,401)).mockResolvedValueOnce(json(session,201)).mockResolvedValueOnce(json(error,401));
    await expect(createApiClient(transport).catalog()).rejects.toMatchObject({ kind: 'api', api: error });
    expect(transport).toHaveBeenCalledTimes(3);
  });
});
