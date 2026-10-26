import { describe, expect, it } from 'vitest';
import { cheapestCurrentSelection, createResultsState, resultsReducer, selectedQuote, visibleGroups } from './results-reducer';
import { group, observedAt, recovery } from './results-test-data';
const now = Date.parse(observedAt);
const receive = (state: ReturnType<typeof createResultsState>, value: ReturnType<typeof recovery>) => resultsReducer(state, { type: 'receive', recovery: value });
const ids = (state: ReturnType<typeof createResultsState>) => visibleGroups(state).map(g => g.groupId);
describe('authoritative result adoption', () => {
 it('adopts server order initially, freezes on interaction and stages cheaper late arrivals until explicit adoption', () => {
  let state = receive(createResultsState('generation', 'search'), recovery([group('early')]));
  state = receive(state, recovery([group('cheaper', 5000000), group('early')], 2));
  expect(ids(state)).toEqual(['cheaper', 'early']);
  state = resultsReducer(state, { type: 'freeze' });
  state = receive(state, recovery([group('late', 1000000), group('cheaper', 5000000), group('early')], 3));
  expect(ids(state)).toEqual(['cheaper', 'early']);
  expect(state.latest?.sequence).toBe(3);
  state = resultsReducer(state, { type: 'adopt' });
  expect(ids(state)).toEqual(['late', 'cheaper', 'early']);
  expect(state.frozen).toBe(true);
 });
 it('rejects stale sequence, mismatched generation and different search ID without overwriting either snapshot', () => {
  let state = receive(createResultsState('generation', 'search'), recovery([group('current')], 5));
  state = receive(state, recovery([group('stale')], 4));
  const wrong = recovery([group('wrong')], 8); wrong.snapshot.clientGeneration = 'old';
  state = receive(state, wrong); wrong.snapshot.clientGeneration = 'generation'; wrong.snapshot.searchId = 'other';
  state = receive(state, wrong);
  expect(ids(state)).toEqual(['current']); expect(state.latest?.sequence).toBe(5);
 });
 it('preserves adopted fare facts while a newer representative and its explanations are staged', () => {
  let state = receive(createResultsState('generation', 'search'), recovery([group('a')]));
  state = resultsReducer(state, { type: 'freeze' });
  state = receive(state, recovery([group('a', 20000000)], 2));
  expect(visibleGroups(state)[0]?.eligibleQuotes[0]?.total.amountRial).toBe(10000000);
 });
 it('selection is an exact visible quote version, remains stable through adoption and invalidates immediately on removal', () => {
  let state = receive(createResultsState('generation', 'search'), recovery([group('a')]));
  state = resultsReducer(state, { type: 'select', selection: { groupId: 'a', quoteId: 'a-quote', version: 1 }, now });
  expect(selectedQuote(state, now)?.quoteId).toBe('a-quote');
  state = receive(state, recovery([group('b'), group('a')], 2));
  state = resultsReducer(state, { type: 'adopt' });
  expect(selectedQuote(state, now)?.quoteId).toBe('a-quote');
  state = receive(state, recovery([group('b')], 3));
  expect(state.selected?.quoteId).toBe('a-quote'); expect(selectedQuote(state, now)).toBeUndefined();
  expect(ids(state)).toEqual(['b','a']);
 });
 it('blocks expiry and version replacement immediately while retaining the selected identity for explanation', () => {
  let state = receive(createResultsState('generation', 'search'), recovery([group('a')]));
  state = resultsReducer(state, { type: 'select', selection: { groupId: 'a', quoteId: 'a-quote', version: 1 }, now });
  expect(selectedQuote(state, now + 600000)).toBeUndefined();
  const next = group('a'); next.eligibleQuotes[0]!.version = 2;
  state = receive(state, recovery([next], 2));
  expect(selectedQuote(state, now)).toBeUndefined();
 });
 it('rejects selecting a hidden staged quote or an expired quote, and scopes suggestion dismissal to this search', () => {
  let state = receive(createResultsState('generation', 'search'), recovery([group('a')]));
  state = resultsReducer(state, { type: 'freeze' });
  state = receive(state, recovery([group('b'),group('a')], 2));
  state = resultsReducer(state, { type: 'select', selection: { groupId: 'b', quoteId: 'b-quote', version: 1 }, now });
  expect(state.selected).toBeUndefined();
  state = resultsReducer(state, { type: 'select', selection: { groupId: 'a', quoteId: 'a-quote', version: 1 }, now: now+600000 });
  expect(state.selected).toBeUndefined();
  state = resultsReducer(state, { type: 'dismiss-suggestion' }); expect(state.dismissedSuggestion).toBe(true);
  expect(createResultsState('new', 'new').dismissedSuggestion).toBe(false);
 });
});

describe('settled cheapest default selection',()=>{
 const settled = (groups: ReturnType<typeof group>[], sequence=1) => {const value=recovery(groups,sequence);value.snapshot.status='complete';return value;};
 it('chooses the actual cheapest eligible quote independently of server group/provider ordering',()=>{
  const fast=group('fast',20000000),cheap=group('cheap',12000000);
  cheap.eligibleQuotes.push({...structuredClone(cheap.eligibleQuotes[0]!),quoteId:'best-provider',providerId:'other',total:{amountRial:1000000,currency:'IRR'}});
  const value=settled([fast,cheap]);value.snapshot.query={...value.snapshot.query,sort:'fastest'};
  let state=receive(createResultsState('generation','search'),value);
  const evidence=JSON.stringify(value);
  state=resultsReducer(state,{type:'select-default',sequence:1,now});
  expect(state.selected).toEqual({groupId:'cheap',quoteId:'best-provider',version:1});
  expect(state.selectionSource).toBe('automatic');expect(ids(state)).toEqual(['fast','cheap']);expect(JSON.stringify(value)).toBe(evidence);
 });
 it('waits for terminal adopted evidence and cannot select an earlier sequence while cheaper final evidence is staged',()=>{
  let state=receive(createResultsState('generation','search'),recovery([group('early')]));
  expect(resultsReducer(state,{type:'select-default',sequence:1,now}).selected).toBeUndefined();
  state=resultsReducer(state,{type:'freeze'});state=receive(state,settled([group('late',1000000),group('early')],2));
  expect(resultsReducer(state,{type:'select-default',sequence:1,now}).selected).toBeUndefined();
  expect(resultsReducer(state,{type:'select-default',sequence:2,now}).selected).toBeUndefined();
  state=resultsReducer(state,{type:'adopt'});state=resultsReducer(state,{type:'select-default',sequence:2,now});
  expect(state.selected?.quoteId).toBe('late-quote');
 });
 it('manual choice wins over a queued automatic selection and never changes on later defaults or expiry',()=>{
  let state=receive(createResultsState('generation','search'),settled([group('manual'),group('cheap',1000000)]));
  const selection={groupId:'manual',quoteId:'manual-quote',version:1};
  state=resultsReducer(state,{type:'select',selection,now});const selected=state;
  expect(resultsReducer(state,{type:'select-default',sequence:1,now})).toBe(selected);
  state=receive(state,settled([group('new',500000),group('manual')],2));state=resultsReducer(state,{type:'adopt'});
  state=resultsReducer(state,{type:'select-default',sequence:2,now:now+600000});
  expect(state.selected).toEqual(selection);expect(state.selectionSource).toBe('manual');expect(selectedQuote(state,now+600000)).toBeUndefined();
 });
 it('excludes expired, future, incomplete, ineligible and changed quote evidence',()=>{
  const expired=group('expired',1),future=group('future',2),incomplete=group('incomplete',3),ineligible=group('ineligible',4),changed=group('changed',5);
  expired.eligibleQuotes[0]!.expiresAt=observedAt;future.eligibleQuotes[0]!.observedAt='2026-10-25T06:01:00.000Z';incomplete.eligibleQuotes[0]!.completeness={status:'incomplete',missing:['fee']};ineligible.eligibleQuotes[0]!.eligibility={status:'ineligible',reasons:['seat']};
  let state=receive(createResultsState('generation','search'),settled([expired,future,incomplete,ineligible,changed]));
  state=resultsReducer(state,{type:'freeze'});state=receive(state,settled([expired,future,incomplete,ineligible,group('changed',6)],2));
  expect(cheapestCurrentSelection(state,now)).toBeUndefined();
 });
 it.each(['collecting','empty','failed','cancelled'] as const)('does not auto-select from %s snapshots',status=>{
  const value=settled([group('a')]);value.snapshot.status=status;const state=receive(createResultsState('generation','search'),value);
  expect(resultsReducer(state,{type:'select-default',sequence:1,now})).toBe(state);
 });
});

describe('suggestion evidence lifetime',()=>{
 it('suppresses a suggestion as soon as the baseline expires or disappears, even with a current alternative',async()=>{
  const {resolveSuggestion}=await import('./results-reducer');
  const baseline=group('baseline'),target=group('alternative',10500000);baseline.durationMinutes=240;target.durationMinutes=90;target.eligibleQuotes[0]!.expiresAt='2026-10-25T06:20:00.000Z';
  const value=recovery([baseline,target]);value.snapshot.suggestion={kind:'faster-journey',alternativeId:'alternative-quote',baselineId:'baseline-quote',delta:{amountRial:500000,minutes:150,priceRatio:1.05},coverage:{expectedProviderIds:['p'],successfulProviderIds:['p'],failedProviderIds:[],pendingProviderIds:[],complete:true},dismissalScope:{searchId:'search'}};
  let state=receive(createResultsState('generation','search'),value);expect(resolveSuggestion(state,now)?.target.group.groupId).toBe('alternative');
  expect(resolveSuggestion(state,now+600000)).toBeUndefined();state=resultsReducer(state,{type:'freeze'});state=receive(state,recovery([target],2));expect(resolveSuggestion(state,now)).toBeUndefined();
 });
});
