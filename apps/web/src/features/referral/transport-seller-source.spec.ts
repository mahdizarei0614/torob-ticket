import { afterEach, describe, expect, it, vi } from 'vitest';
import { group, observedAt, recovery } from '../results/results-test-data';
import { createResultsState, resultsReducer } from '../results/results-reducer';
import type { ReferralSource } from './referral-controller';
import { transportSellerSource } from './transport-seller-source';

afterEach(()=>vi.restoreAllMocks());
function fixture() {
 const g=group('sellers'),first=g.eligibleQuotes[0]!;
 const second={...structuredClone(first),quoteId:'other-seller',providerId:'second'};g.eligibleQuotes.push(second);
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt));
 const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:recovery([g])});
 state.selected={groupId:g.groupId,quoteId:first.quoteId,version:first.version};
 const source=(quote=first):ReferralSource=>({key:quote.quoteId,payload:{kind:'transport',quote,itinerary:g.itinerary},isCurrent:()=>true,accept:()=>true,confirmed:()=>true,refresh:()=>undefined});
 let current=source();
 const evidence={state,select:vi.fn((selection)=>{current=source(g.eligibleQuotes.find(q=>q.quoteId===selection.quoteId)!);})};
 return {g,first,second,evidence,source,resolve:()=>current,setCurrent:(next:ReferralSource)=>{current=next;}};
}
describe('seller icon source authority',()=>{
 it('selects a same-price sibling before resolving its own quote lease',()=>{
  const f=fixture();const selected=transportSellerSource({quote:f.second,groupId:f.g.groupId,evidence:f.evidence,canSelect:()=>true,currentSource:f.resolve});
  expect(f.evidence.select).toHaveBeenCalledWith({groupId:f.g.groupId,quoteId:f.second.quoteId,version:1});
  expect(selected?.payload.quote).toEqual(f.second);
 });
 it('rejects edited intent, expired siblings and a failed selection that still owns the previous seller',()=>{
  const f=fixture();const resolve=()=>transportSellerSource({quote:f.second,groupId:f.g.groupId,evidence:f.evidence,canSelect:()=>true,currentSource:f.resolve});
  expect(transportSellerSource({quote:f.second,groupId:f.g.groupId,evidence:f.evidence,canSelect:()=>false,currentSource:f.resolve})).toBeUndefined();
  expect(f.evidence.select).not.toHaveBeenCalled();
  f.evidence.select.mockImplementation(()=>undefined);expect(resolve()).toBeUndefined();
  f.evidence.select.mockClear();vi.spyOn(Date,'now').mockReturnValue(Date.parse(f.second.expiresAt));
  expect(resolve()).toBeUndefined();expect(f.evidence.select).not.toHaveBeenCalled();
 });
 it('retains an accepted version for the selected seller instead of restoring its old displayed price',()=>{
  const f=fixture();const accepted=f.source({...f.first,version:2,total:{...f.first.total,amountRial:12000000}});f.setCurrent(accepted);
  const selected=transportSellerSource({quote:f.first,groupId:f.g.groupId,evidence:f.evidence,canSelect:()=>true,currentSource:f.resolve});
  expect(selected).toBe(accepted);expect(selected?.payload.quote.version).toBe(2);expect(f.evidence.select).not.toHaveBeenCalled();
 });
 it('rejects a selected same-version lease revoked by newer result evidence before effects run',()=>{
  const f=fixture();const next=recovery([{...f.g,eligibleQuotes:[]}],2);
  f.evidence.state.latest={sequence:next.sequence,snapshot:next.snapshot};
  expect(transportSellerSource({quote:f.first,groupId:f.g.groupId,evidence:f.evidence,canSelect:()=>true,currentSource:f.resolve})).toBeUndefined();
  expect(f.evidence.select).not.toHaveBeenCalled();
 });
});
