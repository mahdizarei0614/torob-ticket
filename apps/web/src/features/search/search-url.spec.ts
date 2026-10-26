import { describe, expect, it } from 'vitest';
import { consumerDraft, dateBounds, defaultClassCode, parseConsumerSearchUrl, parseSearchUrl, serializeSearchUrl, validateDraft } from './search-url';
import { catalog, query, session } from './search-test-data';
describe('canonical committed search intent', () => {
  it('normalizes new consumer links to one adult without rewriting the general evidence codec',()=>{
    const prior={...query,party:{adults:2,children:1,infants:1,childAges:[8],infantAgesMonths:[6]}};
    const url=serializeSearchUrl(prior);
    expect(parseSearchUrl(url,catalog,session).query?.party).toEqual(prior.party);
    expect(parseConsumerSearchUrl(url,catalog,session).query?.party).toEqual({adults:1,children:0,infants:0});
    expect(prior.party.adults).toBe(2);expect(consumerDraft(prior,catalog).party).not.toHaveProperty('childAges');
  });
  it('selects a valid class by preference, preserves compatible choices, and falls back to the actual catalog',()=>{
    const choices={...catalog,classChoices:[{mode:'flight' as const,code:'business',name:'Business'},...catalog.classChoices,{mode:'bus' as const,code:'standard',name:'Standard'},{mode:'bus' as const,code:'vip',name:'VIP'}]};
    expect(defaultClassCode('flight',choices)).toBe('economy');expect(defaultClassCode('flight',choices,'business')).toBe('business');expect(defaultClassCode('train',choices,'economy')).toBe('seat');expect(defaultClassCode('bus',choices)).toBe('standard');
    expect(defaultClassCode('bus',{...choices,classChoices:choices.classChoices.filter(choice=>choice.code!=='standard')})).toBe('vip');
    expect(parseConsumerSearchUrl(serializeSearchUrl({...query,classCode:'outdated'}),catalog,session).query?.classCode).toBe('economy');
  });
  it('round trips every field, including filter canonicalization without preview state', () => {
    const input = { ...query, filters: { providerIds: ['p','p'], refundableOnly: true }, party: { adults: 1, children: 1, infants: 0, childAges: [8] } };
    const url = serializeSearchUrl(input);
    expect(parseSearchUrl(url, catalog, session)).toMatchObject({ kind: 'valid', query: { ...input, filters: { providerIds: ['p'], refundableOnly: true } } });
    expect(serializeSearchUrl(parseSearchUrl(url, catalog, session).query!)).toBe(url);
  });
  it.each(['?q=', '?q=%ZZ', '?q={}', '?q=[]', '?q=x&q=y', '?unknown=1', '?q=' + 'x'.repeat(13000)])('rejects malformed or ambiguous URL %s', url => {
    expect(parseSearchUrl(url, catalog, session).kind).toBe('invalid');
  });
  it('uses origin and destination local anchor days, inclusive only through day 89', () => {
    const boundary = { ...session, anchorInstant: '2026-10-24T22:00:00Z' };
    expect(dateBounds(boundary, 'Asia/Tehran')).toEqual({ min: '2026-10-25', max: '2027-01-22' });
    expect(dateBounds(boundary, 'America/Los_Angeles')).toEqual({ min: '2026-10-24', max: '2027-01-21' });
    const zones = { ...catalog, cities: catalog.cities.map(c => c.id === 'b' ? { ...c, timeZone: 'America/Los_Angeles' } : c) };
    expect(validateDraft({ ...query, tripType: 'round-trip', returnDate: '2027-01-22' }, zones, boundary).valid).toBe(false);
    expect(validateDraft({ ...query, tripType: 'round-trip', returnDate: '2027-01-21' }, zones, boundary).valid).toBe(true);
  });
  it('preserves every hidden filter and sort in a round-trip deep link', () => {
    const input = { ...query, tripType: 'round-trip' as const, returnDate: query.departureDate, sort: 'fastest' as const, filters: { providerIds: ['p'], operatorIds: ['operator-restricted'], budgetMaxRial: 5000000, departureWindow: { startMinute: 60, endMinute: 900 }, maxStopsOrTransfers: 1, checkedBaggageMinKg: 10, refundableOnly: true } };
    expect(parseSearchUrl(serializeSearchUrl(input), catalog, session)).toEqual({ kind: 'valid', query: input });
  });
  it('rejects unsupported network/classes/filters/age and out of coverage dates', () => {
    for (const input of [{ ...query, destinationCityId: 'c' }, { ...query, classCode: 'fake' }, { ...query, filters: { providerIds: ['missing'] } }, { ...query, party: { adults: 1, children: 1, infants: 0 } }, { ...query, departureDate: '2027-01-23' }]) expect(validateDraft(input, catalog, session).valid).toBe(false);
    expect(validateDraft({ ...query, tripType: 'round-trip', returnDate: query.departureDate }, catalog, session).valid).toBe(true);
  });
});
