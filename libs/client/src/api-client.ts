import { z } from 'zod';
import { ApiErrorSchema, CatalogSnapshotSchema, CreateDemoSessionInputSchema, IdSchema, SearchRecoverySchema, SearchRequestSchema, SessionInfoSchema, type ApiError, type CreateDemoSessionInput, type SearchRequest, type SessionInfo } from '@torob-ticket/contracts';
export class ClientError extends Error {
  constructor(readonly kind: 'api' | 'network' | 'schema' | 'request' | 'http', message: string, readonly api?: ApiError, readonly status?: number) { super(message); this.name = 'ClientError'; }
}
type Transport = typeof fetch;
/** Fixed same-origin routes only. Mutations are sent once; caller owns deliberate retry. */
export function createApiClient(transport: Transport = (...args) => fetch(...args)) {
  let latestSession: SessionInfo | undefined;
  let bootstrap: Promise<SessionInfo> | undefined;
  async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try { response = await transport(`/api/v1/${path}`, { ...init, credentials: 'same-origin', headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } }); }
    catch (error) { if (init.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error; throw new ClientError('network', 'network-unavailable'); }
    let raw: unknown;
    try { raw = await response.json(); } catch (error) { if (init.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error; throw new ClientError('schema', 'invalid-json-response', undefined, response.status); }
    if (!response.ok) {
      const error = ApiErrorSchema.safeParse(raw);
      if (error.success) throw new ClientError('api', error.data.code, error.data, response.status);
      throw new ClientError('http', 'unexpected-http-response', undefined, response.status);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new ClientError('schema', 'invalid-response-contract', undefined, response.status);
    return parsed.data;
  }
  function body<T>(schema: z.ZodType<T>, input: unknown) { const parsed = schema.safeParse(input); if (!parsed.success) throw new ClientError('request', 'invalid-request-contract'); return JSON.stringify(parsed.data); }
  function idPath(id: string) { const parsed = IdSchema.safeParse(id); if (!parsed.success) throw new ClientError('request', 'invalid-id'); return encodeURIComponent(parsed.data); }
  function session() {
    if (!bootstrap) bootstrap = request('demo/session', SessionInfoSchema, { method: 'POST', body: '{}' }).then(value => { latestSession = value; return value; }).finally(() => { bootstrap = undefined; });
    return bootstrap;
  }
  async function catalog(signal?: AbortSignal) {
    try { return await request('catalog', CatalogSnapshotSchema, { signal }); }
    catch (error) {
      if (!(error instanceof ClientError) || error.api?.code !== 'SESSION_EXPIRED' || signal?.aborted) throw error;
      await session();
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return request('catalog', CatalogSnapshotSchema, { signal });
    }
  }
  return {
    session, catalog,
    sessionSnapshot: () => latestSession,
    async reset(input: CreateDemoSessionInput = {}, signal?: AbortSignal) { const payload = body(CreateDemoSessionInputSchema, input); if (bootstrap) await bootstrap; return request('demo/reset', SessionInfoSchema, { method: 'POST', body: payload, signal }); },
    async startSearch(input: SearchRequest, signal?: AbortSignal) { return request('searches', SearchRecoverySchema, { method: 'POST', body: body(SearchRequestSchema, input), signal }); },
    async snapshot(id: string, signal?: AbortSignal) { return request(`searches/${idPath(id)}`, SearchRecoverySchema, { signal }); },
    async cancelSearch(id: string, signal?: AbortSignal) { return request(`searches/${idPath(id)}/cancel`, SearchRecoverySchema, { method: 'POST', signal }); },
  };
}
export const apiClient = createApiClient();
export type ApiClient = ReturnType<typeof createApiClient>;
