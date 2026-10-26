import { ItinerarySchema, QuoteSnapshotSchema, ReferralReceiptSchema, type Itinerary, type Place, type QuoteSnapshot, type ReferralReceipt, type TransportSearchQuery } from '@torob-ticket/contracts';
import { contextForPoints } from '@torob-ticket/graphics/host';
import type { SearchDraft } from '../search/search-url';
import type { QuoteSelection } from '../results/results-reducer';
export interface MapOwner { generation: string; searchId: string }
export interface MapContext { draft: SearchDraft; committed?: TransportSearchQuery; generation?: string; searchId?: string; current: boolean; resetting?: boolean; revision: number; cause: 'initial'|'edit'|'preset'|'restore'|'search'|'refine'|'date'; places?:readonly Place[] }
export interface MapInspection { itinerary: Itinerary; query: TransportSearchQuery; owner: MapOwner; historical?: boolean }
export interface MapState {
  context: MapContext; pin?: MapInspection; preview?: MapInspection; hover?:MapInspection; focus?:MapInspection;
  selection?: {quote:QuoteSnapshot;inspection:MapInspection;valid:boolean;source:'result'|'recheck'};
  resultIntent?:QuoteSelection; receipt?: ReferralReceipt;
  direction:'outbound'|'return'; fitEpoch:number; projection:{centralLongitude:number}; cameraMode:'geography'|'route';
}
export type MapAction =
  | {type:'context';context:MapContext}
  | {type:'preview';inspection?:MapInspection;owner:MapOwner;source?:'hover'|'focus';leavingId?:string}
  | {type:'pin';inspection:MapInspection}
  | {type:'selection';inspection?:MapInspection;quote?:QuoteSnapshot;owner:MapOwner;intent?:QuoteSelection}
  | {type:'direction';direction:'outbound'|'return'}
  | {type:'clear-inspection'}
  | {type:'bind-rechecked';owner:MapOwner;previous:{quoteId:string;version:number};quote:QuoteSnapshot;itinerary:Itinerary;now:number}
  | {type:'confirm';receipt:ReferralReceipt;owner:MapOwner;now:number}
  | {type:'hydrate-receipt';owner:MapOwner;origin:QuoteSnapshot;itinerary:Itinerary;receipt:ReferralReceipt;now:number};
export const sameOwner = (a:MapOwner|undefined,b:MapOwner|undefined) => Boolean(a && b && a.generation===b.generation && a.searchId===b.searchId);
const ownerFor = (context:MapContext):MapOwner|undefined => context.current && !context.resetting && context.generation && context.searchId ? {generation:context.generation,searchId:context.searchId} : undefined;
const travelKey = (query:SearchDraft) => JSON.stringify([query.mode,query.scope,query.originCityId,query.destinationCityId,query.departureDate,query.returnDate,query.tripType,query.party,query.classCode]);
const networkKey = (query:SearchDraft) => JSON.stringify([query.mode,query.scope,query.originCityId,query.destinationCityId]);
export const contextKey = (context:MapContext) => JSON.stringify([context.revision,context.cause,context.generation,context.searchId,context.current,context.resetting,context.draft,context.committed]);
export function createMapState(context:MapContext):MapState {return {context,direction:'outbound',fitEpoch:0,projection:{centralLongitude:0},cameraMode:'geography'};}
function current(state:MapState,owner:MapOwner) {return sameOwner(ownerFor(state.context),owner);}
/** Context reconciliation is also used at render, so an old payload never flashes before an effect. */
export function reconcileMapState(state:MapState,context:MapContext):MapState {
  if(contextKey(state.context)===contextKey(context)) return state;
  const previous=state.context;const intentChanged=previous.revision!==context.revision || previous.generation!==context.generation;
  const draftChanged=JSON.stringify(previous.draft)!==JSON.stringify(context.draft);
  const geoChanged=networkKey(previous.draft)!==networkKey(context.draft);
  const restore=context.cause==='restore' && intentChanged;
  const reset=Boolean(context.resetting);
  const historical=context.cause==='refine' && intentChanged && travelKey(previous.draft)===travelKey(context.draft) && !reset;
  const clear=reset || restore || (intentChanged && !historical) || draftChanged;
  if(historical) return {...state,context,pin:state.pin ? {...state.pin,historical:true} : undefined,preview:undefined,hover:undefined,focus:undefined,selection:undefined,resultIntent:undefined,receipt:undefined};
  if(clear) return {...state,context,pin:undefined,preview:undefined,hover:undefined,focus:undefined,selection:undefined,resultIntent:sameOwner(ownerFor(previous),ownerFor(context))?state.resultIntent:undefined,receipt:undefined,
    direction:geoChanged || restore || context.draft.tripType==='one-way' ? 'outbound' : state.direction,
    ...(geoChanged || restore || reset && !previous.resetting ? {fitEpoch:state.fitEpoch+1,projection:{centralLongitude:0},cameraMode:'geography' as const} : {})};
  return {...state,context};
}
function canonical(value:unknown):string {
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>JSON.stringify(key)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
const validQuote = (quote:QuoteSnapshot,now:number) => quote.completeness.status==='complete' && quote.eligibility.status==='eligible' && Date.parse(quote.observedAt)<=now && Date.parse(quote.expiresAt)>now;
function receiptMatches(state:MapState,receipt:ReferralReceipt,now:number) {
  const bound=state.selection;
  if(!bound || receipt.selection.kind!=='transport' || receipt.payload.kind!=='transport') return false;
  const at=Date.parse(receipt.confirmedAt);
  return validQuote(bound.quote,at) && receipt.selection.quoteId===bound.quote.quoteId && receipt.selection.quoteVersion===bound.quote.version && canonical(receipt.payload.quote)===canonical(bound.quote) && canonical(receipt.payload.itinerary)===canonical(bound.inspection.itinerary) && at<=now && at>=Date.parse(bound.quote.observedAt) && at<Date.parse(bound.quote.expiresAt);
}
export function mapReducer(state:MapState,action:MapAction):MapState {
  switch(action.type) {
    case 'context':return reconcileMapState(state,action.context);
    case 'preview': {
      if(!current(state,action.owner) || action.inspection && !sameOwner(action.inspection.owner,action.owner))return state;
      const source=action.source??'hover';
      if(!action.inspection && action.leavingId && state[source]?.itinerary.itineraryId!==action.leavingId)return state;
      const next={...state,[source]:action.inspection};return {...next,preview:next.hover??next.focus};
    }
    case 'pin': {
      if(!current(state,action.inspection.owner)) return state;
      const legs=[action.inspection.itinerary.outbound,action.inspection.itinerary.return].filter(Boolean);
      const ids=legs.flatMap(leg=>leg!.segments.flatMap(segment=>[segment.originPlaceId,segment.destinationPlaceId]));
      const points=(state.context.places??[]).filter(place=>ids.includes(place.id)).map(place=>place.point);
      return {...state,pin:{...action.inspection,historical:false},preview:undefined,hover:undefined,focus:undefined,selection:undefined,receipt:undefined,fitEpoch:state.fitEpoch+1,projection:contextForPoints(points),cameraMode:'route',direction:state.direction==='return' && action.inspection.itinerary.return ? 'return' : 'outbound'};
    }
    case 'selection': {
      if(!current(state,action.owner)) return state;
      // A passive delivery cannot resurrect a pre-edit choice or overwrite an accepted fresh recheck.
      if(action.quote && action.intent && action.intent===state.resultIntent && !state.selection)return state;
      if(action.intent && action.intent===state.resultIntent && state.selection?.source==='recheck') return state;
      if(!action.quote || !action.inspection) return {...state,resultIntent:action.intent,selection:state.selection ? {...state.selection,valid:false} : undefined};
      if(!sameOwner(action.inspection.owner,action.owner) || action.quote.itineraryId!==action.inspection.itinerary.itineraryId) return state;
      const unchanged=state.selection && canonical(state.selection.quote)===canonical(action.quote) && sameOwner(state.selection.inspection.owner,action.owner);
      return {...state,resultIntent:action.intent,selection:{quote:action.quote,inspection:action.inspection,valid:true,source:'result'},receipt:unchanged ? state.receipt : undefined};
    }
    case 'direction':return {...state,direction:action.direction};
    case 'clear-inspection': {const different=state.pin && networkKey(state.pin.query)!==networkKey(state.context.draft) || state.preview && networkKey(state.preview.query)!==networkKey(state.context.draft);return {...state,pin:undefined,preview:undefined,hover:undefined,focus:undefined,selection:undefined,receipt:undefined,...(different?{fitEpoch:state.fitEpoch+1,projection:{centralLongitude:0},cameraMode:'geography' as const}:{})};}
    case 'bind-rechecked': {
      const previous=state.selection;const quote=QuoteSnapshotSchema.safeParse(action.quote);const itinerary=ItinerarySchema.safeParse(action.itinerary);
      if(!current(state,action.owner) || !previous || !quote.success || !itinerary.success || action.previous.quoteId!==previous.quote.quoteId || action.previous.version!==previous.quote.version || !validQuote(quote.data,action.now)) return state;
      const next=quote.data;
      if(next.quoteId!==previous.quote.quoteId || next.version<=previous.quote.version || next.providerId!==previous.quote.providerId || next.fareId!==previous.quote.fareId || next.itineraryId!==previous.quote.itineraryId || canonical(next.party)!==canonical(previous.quote.party) || canonical(itinerary.data)!==canonical(previous.inspection.itinerary)) return state;
      return {...state,selection:{quote:next,inspection:previous.inspection,valid:true,source:'recheck'},receipt:undefined};
    }
    case 'hydrate-receipt': {
      // Caller supplies an origin member fetched from this cookie-scoped search.
      // Historical confirmation time validates the event; it never extends current validity.
      const parsed=ReferralReceiptSchema.safeParse(action.receipt),origin=QuoteSnapshotSchema.safeParse(action.origin),itinerary=ItinerarySchema.safeParse(action.itinerary);
      if(!current(state,action.owner)||!state.context.committed||!parsed.success||!origin.success||!itinerary.success||parsed.data.payload.kind!=='transport')return state;
      const receipt=parsed.data,payload=parsed.data.payload;if(payload.kind!=='transport')return state;const next=payload.quote,old=origin.data;
      if(next.quoteId!==old.quoteId||next.version<old.version||next.providerId!==old.providerId||next.fareId!==old.fareId||next.itineraryId!==old.itineraryId||next.itineraryId!==itinerary.data.itineraryId||canonical(next.party)!==canonical(old.party)||canonical(payload.itinerary)!==canonical(itinerary.data)||receipt.handoffPath!==`/provider-demo/${receipt.referralId}`)return state;
      const inspection:MapInspection={itinerary:itinerary.data,query:state.context.committed,owner:action.owner};
      const selected:MapState={...state,pin:inspection,preview:undefined,hover:undefined,focus:undefined,selection:{quote:next,inspection,valid:true,source:'recheck'},cameraMode:'route'};
      return receiptMatches(selected,receipt,action.now)?{...selected,receipt}:state;
    }
    case 'confirm': {
      const parsed=ReferralReceiptSchema.safeParse(action.receipt);
      return current(state,action.owner) && parsed.success && receiptMatches(state,parsed.data,action.now) ? {...state,receipt:parsed.data} : state;
    }
  }
}
export function mapView(raw:MapState,now:number) {
  const state=reconcileMapState(raw,raw.context);const inspection=state.preview??state.pin;
  const itinerary=inspection?.itinerary;const direction=state.direction==='return' && (itinerary ? itinerary.return : state.context.draft.tripType==='round-trip' && state.context.draft.returnDate) ? 'return' as const : 'outbound' as const;
  const historical=Boolean(inspection?.historical || inspection && !sameOwner(inspection.owner,ownerFor(state.context)));
  const displayedSelected=state.selection && sameOwner(state.selection.inspection.owner,ownerFor(state.context)) && itinerary?.itineraryId===state.selection.inspection.itinerary.itineraryId && canonical(itinerary)===canonical(state.selection.inspection.itinerary);
  const compared=ownerFor(state.context) && (inspection || state.context.committed && canonical(state.context.draft)===canonical(state.context.committed));
  let progress:0|.35|.7|1=historical ? 0 : compared ? .35 : 0;
  if(displayedSelected && state.selection?.valid && validQuote(state.selection.quote,now)) progress=.7;
  // A real immutable referral event remains historical truth after its quote expires.
  if(displayedSelected && state.receipt && receiptMatches(state,state.receipt,now)) progress=1;
  return {itinerary,inspection,query:inspection?.query??state.context.draft,scope:inspection?.query.scope??state.context.draft.scope,mode:itinerary?.mode??state.context.draft.mode,progress,historical,direction,selectedValid:Boolean(displayedSelected && state.selection?.valid && validQuote(state.selection.quote,now))};
}
