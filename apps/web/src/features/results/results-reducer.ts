import type { ComparisonGroup, QuoteSnapshot, SearchRecovery } from '@torob-ticket/contracts';
export interface QuoteSelection { groupId: string; quoteId: string; version: number }
export interface ResultsState { generation: string; searchId: string; adopted?: SearchRecovery; latest?: SearchRecovery; frozen: boolean; selected?: QuoteSelection; selectionSource?: 'automatic' | 'manual'; dismissedSuggestion: boolean }
export type ResultsAction = { type: 'receive'; recovery: SearchRecovery } | { type: 'freeze' } | { type: 'adopt' } | { type: 'select'; selection: QuoteSelection; now: number } | { type: 'select-default'; sequence: number; now: number } | { type: 'dismiss-suggestion' };
export function createResultsState(generation: string, searchId: string): ResultsState { return { generation, searchId, frozen: false, dismissedSuggestion: false }; }
export function visibleGroups(state: ResultsState): ComparisonGroup[] { return state.adopted?.snapshot.groups ?? []; }
function lookup(recovery: SearchRecovery | undefined, selection: QuoteSelection) { return recovery?.snapshot.groups.find(group => group.groupId === selection.groupId)?.eligibleQuotes.find(quote => quote.quoteId === selection.quoteId && quote.version === selection.version); }
/** Adopted facts stay immutable. New authority may revoke them, never silently replace a fare. */
export function quoteStatus(state: ResultsState, selection: QuoteSelection, now: number): 'current' | 'expired' | 'unavailable' | 'changed' {
 const visible = lookup(state.adopted, selection);
 const current = lookup(state.latest, selection);
 if (!visible || !current || state.latest?.snapshot.status === 'cancelled') return 'unavailable';
 if (Date.parse(visible.observedAt) > now || Date.parse(visible.expiresAt) <= now) return 'expired';
 if (JSON.stringify(visible) !== JSON.stringify(current)) return 'changed';
 return 'current';
}
export function selectedQuote(state: ResultsState, now: number): QuoteSnapshot | undefined { return state.selected && quoteStatus(state, state.selected, now) === 'current' ? lookup(state.adopted, state.selected) : undefined; }
export function hasStagedUpdates(state: ResultsState): boolean { return Boolean(state.adopted && state.latest && state.latest.sequence > state.adopted.sequence && JSON.stringify(state.latest.snapshot) !== JSON.stringify(state.adopted.snapshot)); }
/** Choose from settled server evidence without changing its ranking or quote facts. */
export function cheapestCurrentSelection(state: ResultsState, now: number): QuoteSelection | undefined {
 if (!state.latest || !['complete','partial','interrupted'].includes(state.latest.snapshot.status)) return undefined;
 let cheapest: { selection: QuoteSelection; amount: number } | undefined;
 for (const group of visibleGroups(state)) for (const quote of group.eligibleQuotes) {
  const selection = {groupId:group.groupId,quoteId:quote.quoteId,version:quote.version};
  if (quote.completeness.status !== 'complete' || quote.eligibility.status !== 'eligible' || quoteStatus(state,selection,now) !== 'current') continue;
  const amount = quote.total.amountRial;
  if (!cheapest || amount < cheapest.amount || amount === cheapest.amount && quote.quoteId.localeCompare(cheapest.selection.quoteId) < 0) cheapest = {selection,amount};
 }
 return cheapest?.selection;
}
export function resultsReducer(state: ResultsState, action: ResultsAction): ResultsState {
 switch (action.type) {
  case 'receive': {
   const { recovery } = action;
   if (recovery.snapshot.searchId !== state.searchId || recovery.snapshot.clientGeneration !== state.generation || recovery.sequence <= (state.latest?.sequence ?? -1)) return state;
   return { ...state, latest: recovery, ...(!state.frozen || !state.adopted?.snapshot.groups.length ? { adopted: recovery } : {}) };
  }
  case 'freeze': return { ...state, frozen: true };
  case 'adopt': return state.latest ? { ...state, adopted: state.latest } : state;
  case 'select': return quoteStatus(state, action.selection, action.now) === 'current' ? { ...state, selected: action.selection, selectionSource:'manual', frozen: true } : state;
  case 'select-default': {
   // Re-evaluate at dispatch time: an intervening manual choice or snapshot wins.
   if (state.selected || state.latest?.sequence !== action.sequence || state.adopted?.sequence !== action.sequence) return state;
   const selection = cheapestCurrentSelection(state,action.now);
   return selection ? {...state,selected:selection,selectionSource:'automatic',frozen:true} : state;
  }
  case 'dismiss-suggestion': return { ...state, dismissedSuggestion: true };
 }
}

/** Resolve only immutable adopted references; live authority may revoke either side. */
export function resolveSuggestion(state: ResultsState, now: number) {
 const snapshot = state.adopted?.snapshot; const suggestion = snapshot?.suggestion;
 if (!snapshot || !suggestion || state.dismissedSuggestion || suggestion.kind !== 'faster-journey' || suggestion.dismissalScope.searchId !== state.searchId) return undefined;
 const coverage = suggestion.coverage;
 if (!coverage.complete || !coverage.expectedProviderIds.length || coverage.failedProviderIds.length || coverage.pendingProviderIds.length || [...new Set(coverage.successfulProviderIds)].sort().join('|') !== [...new Set(coverage.expectedProviderIds)].sort().join('|')) return undefined;
 const resolve = (id: string) => snapshot.groups.flatMap(group => group.eligibleQuotes.map(quote => ({group,quote}))).find(item => item.quote.quoteId === id);
 const target = resolve(suggestion.alternativeId); const baseline = resolve(suggestion.baselineId);
 if (!target || !baseline || [target,baseline].some(item => quoteStatus(state,{groupId:item.group.groupId,quoteId:item.quote.quoteId,version:item.quote.version},now) !== 'current')) return undefined;
 if (suggestion.delta.amountRial !== target.quote.total.amountRial-baseline.quote.total.amountRial || suggestion.delta.minutes !== baseline.group.durationMinutes-target.group.durationMinutes) return undefined;
 return { suggestion,target,baseline };
}
