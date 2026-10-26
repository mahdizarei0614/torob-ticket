import {CancelReferralResultSchema} from '@torob-ticket/contracts';
import {ReferralSelectionSchema,RecheckResultSchema,ConfirmReferralInputSchema,ReferralReceiptSchema,type ReferralSelection,type ConfirmReferralInput,type ReferralIntent,type ReferralReceipt} from '@torob-ticket/contracts';
import { z } from 'zod';
import {HotelSearchQuerySchema,HotelSearchSnapshotSchema,type HotelSearchQuery} from '@torob-ticket/contracts';
import { ApiErrorSchema, DemoAuthStateSchema, SavedSearchSchema, SavedSearchListSchema, DeleteSavedSearchResultSchema, SaveSearchInputSchema, type SaveSearchInput, CatalogSnapshotSchema, CreateDemoSessionInputSchema, DatePriceQuerySchema, DatePriceSnapshotSchema, IdSchema, SearchRecoverySchema, SearchRequestSchema, SessionInfoSchema, type ApiError, type CreateDemoSessionInput, type DatePriceQuery, type SearchRequest, type SessionInfo } from '@torob-ticket/contracts';
export class ClientError extends Error {
  constructor(readonly kind: 'api' | 'network' | 'schema' | 'request' | 'http', message: string, readonly api?: ApiError, readonly status?: number) { super(message); this.name = 'ClientError'; }
}
type Transport = typeof fetch;
function referralPayloadBound(selection:ReferralIntent['selection'],payload:ReferralIntent['quote']) {
  return payload.kind===selection.kind && payload.quote.quoteId===selection.quoteId && payload.quote.version===selection.quoteVersion && payload.quote.completeness.status==='complete' && payload.quote.eligibility.status==='eligible' && (payload.kind!=='transport'||payload.quote.itineraryId===payload.itinerary.itineraryId);
}
function receiptBound(receipt:ReferralReceipt) {
  return referralPayloadBound(receipt.selection,receipt.payload) && receipt.handoffPath===`/provider-demo/${encodeURIComponent(receipt.referralId)}` && Date.parse(receipt.confirmedAt)>=Date.parse(receipt.payload.quote.observedAt) && Date.parse(receipt.confirmedAt)<Date.parse(receipt.payload.quote.expiresAt);
}
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
    async currentSession(signal?:AbortSignal){const value=await request('demo/session',SessionInfoSchema,{signal});latestSession=value;return value;},
    async cancelReferralIntent(id:string){return request(`referrals/intents/${idPath(id)}/cancel`,CancelReferralResultSchema,{method:'POST',body:'{}'});},
    async catalogReadonly(signal?:AbortSignal){return request('catalog',CatalogSnapshotSchema,{signal});},
    async prepareReferral(input:ReferralSelection,signal?:AbortSignal){
      const payload=body(ReferralSelectionSchema,input);const result=await request('referrals/prepare',RecheckResultSchema,{method:'POST',body:payload,signal});
      if(result.status!=='unavailable'){
        const {intent}=result;const selected=intent.selection;
        if(selected.kind!==input.kind||selected.quoteId!==input.quoteId||selected.quoteVersion<=input.quoteVersion||!referralPayloadBound(selected,intent.quote)||Date.parse(intent.expiresAt)<=Date.parse(intent.createdAt))throw new ClientError('schema','referral-prepare-binding');
        if(result.status==='changed'&&(result.previousQuoteVersion!==input.quoteVersion||!referralPayloadBound(input,result.previousQuote)))throw new ClientError('schema','referral-previous-binding');
      }
      return result;
    },
    async confirmReferral(input:ConfirmReferralInput,signal?:AbortSignal){
      const receipt=await request('referrals/confirm',ReferralReceiptSchema,{method:'POST',body:body(ConfirmReferralInputSchema,input),signal});
      if(receipt.intentId!==input.intentId||receipt.selection.quoteVersion!==input.acceptedQuoteVersion||!receiptBound(receipt))throw new ClientError('schema','referral-confirm-binding');return receipt;
    },
    async getReferral(id:string,signal?:AbortSignal){const receipt=await request(`referrals/${idPath(id)}`,ReferralReceiptSchema,{signal});if(receipt.referralId!==id||!receiptBound(receipt))throw new ClientError('schema','referral-read-binding');return receipt;},
    async startHotelSearch(input:HotelSearchQuery,signal?:AbortSignal) { const payload=body(HotelSearchQuerySchema,input);const snapshot=await request('hotel-searches',HotelSearchSnapshotSchema,{method:'POST',body:payload,signal});if(JSON.stringify(snapshot.query)!==payload)throw new ClientError('schema','hotel-query-mismatch');return snapshot; },
    async getHotelSearch(id:string,signal?:AbortSignal) {const snapshot=await request(`hotel-searches/${idPath(id)}`,HotelSearchSnapshotSchema,{signal});if(snapshot.hotelSearchId!==id)throw new ClientError('schema','hotel-search-id-mismatch');return snapshot;},
    async authState(signal?: AbortSignal) { return request('auth/demo',DemoAuthStateSchema,{signal}); },
    async signIn(signal?: AbortSignal) { return request('auth/demo/sign-in',DemoAuthStateSchema,{method:'POST',body:'{}',signal}); },
    async signOut(signal?: AbortSignal) { return request('auth/demo/sign-out',DemoAuthStateSchema,{method:'POST',body:'{}',signal}); },
    async listSavedSearches(signal?: AbortSignal) { return request('saved-searches',SavedSearchListSchema,{signal}); },
    async getSavedSearch(id:string,signal?:AbortSignal) { return request(`saved-searches/${idPath(id)}`,SavedSearchSchema,{signal}); },
    async saveSearch(input:SaveSearchInput,signal?:AbortSignal) { return request('saved-searches',SavedSearchSchema,{method:'POST',body:body(SaveSearchInputSchema,input),signal}); },
    async deleteSavedSearch(id:string,signal?:AbortSignal) { return request(`saved-searches/${idPath(id)}`,DeleteSavedSearchResultSchema,{method:'DELETE',signal}); },
    sessionSnapshot: () => latestSession,
    async reset(input: CreateDemoSessionInput = {}, signal?: AbortSignal) { const payload = body(CreateDemoSessionInputSchema, input); if (bootstrap) await bootstrap; return request('demo/reset', SessionInfoSchema, { method: 'POST', body: payload, signal }); },
    async startSearch(input: SearchRequest, signal?: AbortSignal) { return request('searches', SearchRecoverySchema, { method: 'POST', body: body(SearchRequestSchema, input), signal }); },
    async snapshot(id: string, signal?: AbortSignal) { return request(`searches/${idPath(id)}`, SearchRecoverySchema, { signal }); },
    async cancelSearch(id: string, signal?: AbortSignal) { return request(`searches/${idPath(id)}/cancel`, SearchRecoverySchema, { method: 'POST', signal }); },
    async startDatePrices(input: DatePriceQuery, signal?: AbortSignal) { return request('date-prices', DatePriceSnapshotSchema, { method: 'POST', body: body(DatePriceQuerySchema, input), signal }); },
    async getDatePrices(id: string, clientGeneration: string, signal?: AbortSignal) { return request(`date-prices/${idPath(id)}?clientGeneration=${idPath(clientGeneration)}`, DatePriceSnapshotSchema, { signal }); },
    async cancelDatePrices(id: string, clientGeneration: string, signal?: AbortSignal) { return request(`date-prices/${idPath(id)}?clientGeneration=${idPath(clientGeneration)}`, DatePriceSnapshotSchema, { method: 'DELETE', signal }); },
  };
}
export const apiClient = createApiClient();
export type ApiClient = ReturnType<typeof createApiClient>;
