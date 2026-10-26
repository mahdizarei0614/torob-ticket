import type { CatalogSnapshot, TransportSearchQuery } from '@torob-ticket/contracts';
import { defaultClassCode, type SearchDraft } from './search-url';
export type SearchIntentCause = 'initial'|'edit'|'preset'|'restore'|'search'|'refine'|'date';
export interface SearchState {
  intentRevision: number;
  intentCause: SearchIntentCause;
  draft: SearchDraft;
  committed?: TransportSearchQuery;
  generation?: string;
  searchId?: string;
  previewDate?: string;
  pinnedItineraryId?: string;
  pinnedItineraryHistorical?: boolean;
  previewItineraryId?: string;
  modalDraft?: SearchDraft;
  notice: string;
}
export type SearchAction =
  | { type: 'authority' }
  | { type: 'draft'; patch: Partial<SearchDraft>; catalog: CatalogSnapshot }
  | { type: 'restore'; draft: SearchDraft; query?: TransportSearchQuery; generation: string; notice?: string }
  | { type: 'preset'; draft: SearchDraft }
  | { type: 'date-draft'; draft: SearchDraft; generation: string }
  | { type: 'commit'; query: TransportSearchQuery; generation: string; cause?: SearchIntentCause }
  | { type: 'adopt'; generation: string; searchId: string }
  | { type: 'preview-date'; date?: string }
  | { type: 'preview-itinerary'; id?: string }
  | { type: 'pin-itinerary'; id?: string }
  | { type: 'modal'; draft?: SearchDraft };
export function createSearchState(draft: SearchDraft): SearchState { return { draft: structuredClone(draft), notice: '', intentRevision: 0, intentCause: 'initial' }; }
export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'authority': return {...state,intentRevision:state.intentRevision+1,pinnedItineraryId:undefined,pinnedItineraryHistorical:undefined,previewItineraryId:undefined,notice:'تنظیمات مقایسه تغییر کرده است؛ فرم شما و شواهد قبلی حفظ شدند. برای ادامه قیمت تازه بگیرید.'};
    case 'draft': {
      const draft = { ...state.draft, ...action.patch };
      draft.classCode = defaultClassCode(draft.mode,action.catalog,draft.classCode);
      const clears: string[] = [];
      if (draft.mode !== state.draft.mode || draft.scope !== state.draft.scope || draft.originCityId !== state.draft.originCityId) {
        if (!action.catalog.supportedConnections.some(c => c.mode === draft.mode && c.scope === draft.scope && c.originCityId === draft.originCityId)) { draft.originCityId = ''; clears.push('مبدا'); }
        if (!action.catalog.supportedConnections.some(c => c.mode === draft.mode && c.scope === draft.scope && c.originCityId === draft.originCityId && c.destinationCityId === draft.destinationCityId)) { draft.destinationCityId = ''; clears.push('مقصد'); }
        const filters = { ...draft.filters };
        if (draft.mode !== 'flight' && filters.checkedBaggageMinKg !== undefined) { delete filters.checkedBaggageMinKg; clears.push('فیلتر بار'); }
        if (filters.providerIds?.some(id => !action.catalog.providerCapabilities.some(p => p.providerId === id && p.modes.includes(draft.mode) && p.scopes.includes(draft.scope)))) { delete filters.providerIds; clears.push('فیلتر فروشنده'); }
        if (draft.mode !== state.draft.mode && filters.operatorIds) { delete filters.operatorIds; clears.push('فیلتر شرکت'); }
        draft.filters = filters;
      }
      if (draft.tripType === 'one-way') delete draft.returnDate;
      if (draft.returnDate && draft.returnDate < draft.departureDate) { delete draft.returnDate; clears.push('تاریخ برگشت'); }
      return { ...state, draft, pinnedItineraryId: undefined,pinnedItineraryHistorical:undefined, previewItineraryId: undefined, intentRevision: state.intentRevision+1, intentCause: 'edit', previewDate: undefined, notice: clears.length ? `${clears.join('، ')} با انتخاب تازه سازگار نبود؛ دوباره انتخاب کنید.` : '' };
    }
    case 'restore': return { ...createSearchState(action.draft), committed: action.query, generation: action.generation, intentRevision: state.intentRevision+1, intentCause: 'restore', notice: action.notice ?? '' };
    case 'preset': return { ...state, draft: structuredClone(action.draft), pinnedItineraryId: undefined,pinnedItineraryHistorical:undefined, previewItineraryId: undefined, intentRevision: state.intentRevision+1, intentCause: 'preset', previewDate: undefined, notice: 'سفر پیشنهادی در فرم قرار گرفت؛ برای ثبت آن جست‌وجو کنید.' };
    case 'date-draft': return { ...state, pinnedItineraryId: undefined,pinnedItineraryHistorical:undefined, previewItineraryId: undefined, intentRevision: state.intentRevision+1, intentCause: 'date', draft: structuredClone(action.draft), generation: action.generation, searchId: undefined, previewDate: undefined, notice: 'تاریخ برگشت را دوباره انتخاب کنید.' };
    case 'commit': return { ...createSearchState(action.query), committed: action.query, generation: action.generation, intentRevision: state.intentRevision+1, intentCause: action.cause ?? 'search',...(action.cause==='refine' && state.pinnedItineraryId && state.committed && JSON.stringify([state.committed.mode,state.committed.scope,state.committed.originCityId,state.committed.destinationCityId,state.committed.departureDate,state.committed.returnDate,state.committed.tripType,state.committed.party,state.committed.classCode])===JSON.stringify([action.query.mode,action.query.scope,action.query.originCityId,action.query.destinationCityId,action.query.departureDate,action.query.returnDate,action.query.tripType,action.query.party,action.query.classCode]) ? {pinnedItineraryId:state.pinnedItineraryId,pinnedItineraryHistorical:true}:{}) };
    case 'adopt': return action.generation === state.generation ? { ...state, searchId: action.searchId } : state;
    case 'preview-date': return { ...state, previewDate: action.date };
    case 'preview-itinerary': return { ...state, previewItineraryId: action.id };
    case 'pin-itinerary': return { ...state, pinnedItineraryId: action.id,pinnedItineraryHistorical:undefined, previewItineraryId: undefined };
    case 'modal': return { ...state, modalDraft: action.draft ? structuredClone(action.draft) : undefined };
  }
}
