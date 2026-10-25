import { describe, expect, it } from 'vitest';
import { createSearchState, searchReducer } from './search-reducer';
import { catalog, query } from './search-test-data';
describe('search controller state boundaries', () => {
  it('preserves compatible mode input and explains incompatible fields', () => {
    const state = searchReducer(createSearchState(query), { type: 'draft', patch: { mode: 'train' }, catalog });
    expect(state.draft.originCityId).toBe('a');
    expect(state.draft.destinationCityId).toBe('');
    expect(state.draft.departureDate).toBe(query.departureDate);
    expect(state.draft.classCode).toBe('');
    expect(state.notice).toMatch(/مقصد.*کلاس/);
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
});
