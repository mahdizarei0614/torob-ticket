import { describe, expect, it } from 'vitest';
import { validateParty } from './party';
const noAges = { requiresChildAges: false, requiresInfantAges: false };

describe('provider party validation', () => {
  it('accepts up to nine travelers with one infant per adult', () => {
    expect(validateParty({ adults: 4, children: 1, infants: 4 }, noAges)).toEqual({ valid: true });
  });
  it.each([
    { adults: 0, children: 1, infants: 0 }, { adults: 5, children: 1, infants: 4 },
    { adults: 1, children: 0, infants: 2 }, { adults: 1.5, children: 0, infants: 0 },
    { adults: 1, children: -1, infants: 0 }, { adults: 1, children: 1, infants: 0, childAges: [] },
    { adults: 1, children: 0, infants: 1, infantAgesMonths: [-1] },
  ])('rejects invalid generic party bounds %j', party => {
    expect(validateParty(party, noAges)).toMatchObject({ valid: false, code: 'INVALID_QUERY' });
  });
  it('does not invent ages when no provider rule needs them', () => {
    const party = { adults: 1, children: 1, infants: 1 };
    expect(validateParty(party, noAges)).toEqual({ valid: true });
    expect(party).toEqual({ adults: 1, children: 1, infants: 1 });
  });
  it('requests only the ages needed by this provider', () => {
    expect(validateParty({ adults: 1, children: 1, infants: 1 }, { ...noAges, requiresChildAges: true })).toEqual({ valid: false, code: 'AGE_REQUIRED', fieldPaths: [['childAges']] });
    expect(validateParty({ adults: 1, children: 0, infants: 1 }, { ...noAges, requiresInfantAges: true })).toEqual({ valid: false, code: 'AGE_REQUIRED', fieldPaths: [['infantAgesMonths']] });
    expect(validateParty({ adults: 1, children: 0, infants: 0 }, { requiresChildAges: true, requiresInfantAges: true })).toEqual({ valid: true });
  });
  it('requires ages for authored fare/seat age bands even without a redundant flag', () => {
    expect(validateParty({ adults: 1, children: 1, infants: 0 }, { ...noAges, childAgeRangeYears: { min: 2, max: 11 } })).toMatchObject({ valid: false, code: 'AGE_REQUIRED' });
  });
  it('applies each provider age band inclusively, without universal guessed cutoffs', () => {
    const policy = { ...noAges, childAgeRangeYears: { min: 3, max: 12 }, infantAgeRangeMonths: { min: 0, max: 23 } };
    expect(validateParty({ adults: 2, children: 2, infants: 2, childAges: [3, 12], infantAgesMonths: [0, 23] }, policy)).toEqual({ valid: true });
    expect(validateParty({ adults: 1, children: 1, infants: 0, childAges: [2] }, policy)).toEqual({ valid: false, code: 'INVALID_QUERY', fieldPaths: [['childAges', 0]] });
    expect(validateParty({ adults: 1, children: 0, infants: 1, infantAgesMonths: [24] }, policy)).toEqual({ valid: false, code: 'INVALID_QUERY', fieldPaths: [['infantAgesMonths', 0]] });
  });
  it('does not accept hotel-local child ages as transport ages', () => {
    expect(validateParty({ adults: 1, children: 1, infants: 0, childAgesAtCheckIn: [8] } as never, { ...noAges, requiresChildAges: true })).toMatchObject({ valid: false, code: 'INVALID_QUERY' });
  });
});
