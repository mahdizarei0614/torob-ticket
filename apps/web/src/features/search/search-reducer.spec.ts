import { describe, expect, it } from 'vitest';
import { createSearchState, searchReducer } from './search-reducer';
import { catalog, query } from './search-test-data';
describe('search controller state boundaries', () => {
  it('preserves compatible mode input and explains incompatible fields', () => {
    const state = searchReducer(createSearchState(query), { type: 'draft', patch: { mode: 'train' }, catalog });
    expect(state.draft.originCityId).toBe('a');
    expect(state.draft.destinationCityId).toBe('');
    expect(state.draft.departureDate).toBe(query.departureDate);
    expect(state.draft.classCode).toBe('seat');
    expect(state.notice).toMatch(/مقصد/);expect(state.notice).not.toMatch(/کلاس/);
  });
  it('keeps a compatible class through a scope change and defaults only an unavailable class',()=>{
    const international={...catalog,supportedConnections:[...catalog.supportedConnections,{...catalog.supportedConnections[0]!,scope:'international' as const}],classChoices:[...catalog.classChoices,{mode:'flight' as const,code:'business',name:'Business'}]};
    const state=searchReducer(createSearchState({...query,classCode:'business'}),{type:'draft',patch:{scope:'international'},catalog:international});expect(state.draft.classCode).toBe('business');
    expect(searchReducer(state,{type:'draft',patch:{classCode:''},catalog:international}).draft.classCode).toBe('economy');
  });
  it('preview is separate from committed intent and stale generations never adopt', () => {
    let state = createSearchState(query);
    state = searchReducer(state, { type: 'commit', query, generation: 'new' });
    state = searchReducer(state, { type: 'preview-date', date: '2026-10-26' });
    expect(state.committed).toEqual(query);
    expect(state.previewDate).toBe('2026-10-26');
    expect(searchReducer(state, { type: 'adopt', generation: 'old', searchId: 'stale' })).toBe(state);
    expect(searchReducer(state, { type: 'adopt', generation: 'new', searchId: 'fresh' }).searchId).toBe('fresh');
  });
  it('keeps committed and draft objects isolated from modal draft edits', () => {
    const state = searchReducer(createSearchState(query), { type: 'commit', query, generation: 'g' });
    expect(state.draft).not.toBe(state.committed);
    expect(state.draft.party).not.toBe(state.committed?.party);
    const modal = searchReducer(state, { type: 'modal', draft: state.draft });
    expect(modal.modalDraft).not.toBe(modal.draft);
  });
  it('invalidates return explicitly and never shifts it when departure advances', () => {
    const state = searchReducer(createSearchState({ ...query, tripType: 'round-trip', returnDate: '2026-10-26' }), { type: 'draft', patch: { departureDate: '2026-10-27' }, catalog });
    expect(state.draft.returnDate).toBeUndefined();
    expect(state.notice).toMatch(/برگشت/);
  });
  it.each([{mode:'train'},{scope:'international'},{tripType:'round-trip'},{classCode:'business'}] as const)('clears the visible comparison on a changed form choice %j without rewriting its evidence',patch=>{
    const choices={...catalog,classChoices:[...catalog.classChoices,{mode:'flight' as const,code:'business',name:'تجاری'}]};
    const committed=searchReducer(createSearchState(query),{type:'commit',query,generation:'old'});
    const accepted=searchReducer({...committed,pinnedItineraryId:'selected'},{type:'adopt',generation:'old',searchId:'old-search'});
    const next=searchReducer(accepted,{type:'draft',patch,catalog:choices,generation:'edited'});
    expect(next.searchId).toBeUndefined();expect(next.generation).toBe('edited');expect(next.pinnedItineraryId).toBeUndefined();
    expect(next.committed).toBe(accepted.committed);expect(accepted.searchId).toBe('old-search');expect(accepted.committed).toEqual(query);
    expect(searchReducer(next,{type:'adopt',generation:'old',searchId:'late'})).toBe(next);
  });
  it('keeps the same comparison and intent lease for presentation sorting or an unchanged form choice',()=>{
    const committed=searchReducer(createSearchState(query),{type:'commit',query,generation:'current'});
    const accepted=searchReducer({...committed,pinnedItineraryId:'selected'},{type:'adopt',generation:'current',searchId:'search'});
    const sorted=searchReducer(accepted,{type:'result-sort',sort:'fastest'});
    expect(sorted).toMatchObject({searchId:'search',generation:'current',resultSort:'fastest',pinnedItineraryId:'selected',intentRevision:accepted.intentRevision});
    expect(sorted.committed).toBe(accepted.committed);expect(sorted.draft).toBe(accepted.draft);
    expect(searchReducer(sorted,{type:'draft',patch:{mode:query.mode},catalog}).searchId).toBe('search');
  });
});
