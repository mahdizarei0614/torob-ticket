import type { CatalogSnapshot, TransportSearchQuery } from '@torob-ticket/contracts';
import type { SearchDraft } from './search-url';
export interface SearchState {
  draft: SearchDraft;
  committed?: TransportSearchQuery;
  generation?: string;
  searchId?: string;
  previewDate?: string;
  pinnedItineraryId?: string;
  previewItineraryId?: string;
  modalDraft?: SearchDraft;
  notice: string;
}
export type SearchAction =
  | { type: 'draft'; patch: Partial<SearchDraft>; catalog: CatalogSnapshot }
  | { type: 'restore'; draft: SearchDraft; query?: TransportSearchQuery; generation: string; notice?: string }
  | { type: 'preset'; draft: SearchDraft }
  | { type: 'commit'; query: TransportSearchQuery; generation: string }
  | { type: 'adopt'; generation: string; searchId: string }
  | { type: 'preview-date'; date?: string }
  | { type: 'preview-itinerary'; id?: string }
  | { type: 'pin-itinerary'; id?: string }
  | { type: 'modal'; draft?: SearchDraft };
export function createSearchState(draft: SearchDraft): SearchState { return { draft: structuredClone(draft), notice: '' }; }
export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'draft': {
      const draft = { ...state.draft, ...action.patch };
      const clears: string[] = [];
      if (draft.mode !== state.draft.mode || draft.scope !== state.draft.scope || draft.originCityId !== state.draft.originCityId) {
        if (!action.catalog.supportedConnections.some(c => c.mode === draft.mode && c.scope === draft.scope && c.originCityId === draft.originCityId)) { draft.originCityId = ''; clears.push('مبدا'); }
        if (!action.catalog.supportedConnections.some(c => c.mode === draft.mode && c.scope === draft.scope && c.originCityId === draft.originCityId && c.destinationCityId === draft.destinationCityId)) { draft.destinationCityId = ''; clears.push('مقصد'); }
        if (!action.catalog.classChoices.some(c => c.mode === draft.mode && c.code === draft.classCode)) { draft.classCode = ''; clears.push('کلاس'); }
        const filters = { ...draft.filters };
        if (draft.mode !== 'flight' && filters.checkedBaggageMinKg !== undefined) { delete filters.checkedBaggageMinKg; clears.push('فیلتر بار'); }
        if (filters.providerIds?.some(id => !action.catalog.providerCapabilities.some(p => p.providerId === id && p.modes.includes(draft.mode) && p.scopes.includes(draft.scope)))) { delete filters.providerIds; clears.push('فیلتر فروشنده'); }
        if (draft.mode !== state.draft.mode && filters.operatorIds) { delete filters.operatorIds; clears.push('فیلتر شرکت'); }
        draft.filters = filters;
      }
      if (draft.tripType === 'one-way') delete draft.returnDate;
      if (draft.returnDate && draft.returnDate < draft.departureDate) { delete draft.returnDate; clears.push('تاریخ برگشت'); }
      return { ...state, draft, previewDate: undefined, notice: clears.length ? `${clears.join('، ')} با انتخاب تازه سازگار نبود؛ دوباره انتخاب کنید.` : '' };
    }
    case 'restore': return { ...createSearchState(action.draft), committed: action.query, generation: action.generation, notice: action.notice ?? '' };
    case 'preset': return { ...state, draft: structuredClone(action.draft), previewDate: undefined, notice: 'سفر پیشنهادی در فرم قرار گرفت؛ برای ثبت آن جست‌وجو کنید.' };
    case 'commit': return { ...createSearchState(action.query), committed: action.query, generation: action.generation };
    case 'adopt': return action.generation === state.generation ? { ...state, searchId: action.searchId } : state;
    case 'preview-date': return { ...state, previewDate: action.date };
    case 'preview-itinerary': return { ...state, previewItineraryId: action.id };
    case 'pin-itinerary': return { ...state, pinnedItineraryId: action.id, previewItineraryId: undefined };
    case 'modal': return { ...state, modalDraft: action.draft ? structuredClone(action.draft) : undefined };
  }
}
