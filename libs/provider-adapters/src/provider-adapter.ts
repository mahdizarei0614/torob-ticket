import type { DatePriceQuery, NormalizedOffer, TransportSearchQuery } from '@torob-ticket/contracts';
import type { ProviderContext, ProviderEvidence } from './provider-context';
export type ProviderBatchStatus='success'|'paused'|'timeout'|'cancelled'|'failed'|'unsupported';
export interface ProviderBatch { providerId:string; status:ProviderBatchStatus; records:ProviderEvidence[]; errorCode?:string }
export interface ProviderDateBatch { providerId:string; status:ProviderBatchStatus; dates:{date:string;batch:ProviderBatch}[]; errorCode?:string }
export interface ProviderQuoteSelection { query:TransportSearchQuery; serviceKey:string; previous:NormalizedOffer }
export interface ProviderRecheck { providerId:string; status:ProviderBatchStatus; outcome:'unchanged'|'changed'|'sold-out'|'unavailable'; record?:ProviderEvidence; errorCode?:string }
export interface ProviderAdapter {
  readonly providerId:string;
  search(query:TransportSearchQuery,context:ProviderContext):Promise<ProviderBatch>;
  dateInventory(query:DatePriceQuery,context:ProviderContext):Promise<ProviderDateBatch>;
  recheck(selection:ProviderQuoteSelection,context:ProviderContext):Promise<ProviderRecheck>;
}
