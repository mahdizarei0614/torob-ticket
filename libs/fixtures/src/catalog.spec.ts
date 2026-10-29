import { describe, expect, it } from 'vitest';
import * as fixtures from './index';
import { CatalogSnapshotSchema, type CatalogSnapshot } from '@torob-ticket/contracts';

// Empty foundation is a valid baseline, but cannot satisfy the authored T05 inventory.
const api = fixtures as unknown as { catalog?: CatalogSnapshot; generateProviderRecords?: (input: unknown) => unknown[] };
describe('selectable catalog inventory', () => {
  it('offers the 12 domestic and 22 international cities with validated endpoints', () => {
    const cities = api.catalog?.cities ?? [];
    expect(cities.filter(city => city.countryCode === 'IR')).toHaveLength(12);
    expect(cities.filter(city => city.countryCode !== 'IR')).toHaveLength(22);
    expect(CatalogSnapshotSchema.safeParse(api.catalog).success).toBe(true);
  });
  it('has a seeded generator instead of empty foundation inventory', () => {
    expect(typeof api.generateProviderRecords).toBe('function');
  });
});

const rich = fixtures as unknown as { hotels?: {hotelId:string;destinationCityId:string}[]; roomRateTemplates?: {hotelId:string}[]; materializeRoomRates?:(anchor:string,city:string)=>{nightlyPrices:{date:string;total:{amountRial:number}}[]}[] };
it('backs every selectable city with 12–20 hotels and multiple room options',()=>{
  expect(api.catalog?.cities.length ?? 0).toBe(34);
  for(const city of api.catalog!.cities) {
    const hotels=(rich.hotels??[]).filter(h=>h.destinationCityId===city.id);
    expect(hotels.length).toBeGreaterThanOrEqual(12);expect(hotels.length).toBeLessThanOrEqual(20);
    for(const hotel of hotels) expect((rich.roomRateTemplates??[]).filter(r=>r.hotelId===hotel.hotelId).length).toBeGreaterThanOrEqual(3);
  }
});
it('materializes all 120 hotel nights from the session anchor in destination time',()=>{
  const rates=rich.materializeRoomRates?.('2026-10-24T22:00:00.000Z','mashhad')??[];
  expect(rates.length).toBeGreaterThan(0);
  expect(rates[0]!.nightlyPrices).toHaveLength(120);
  expect(rates[0]!.nightlyPrices[0]!.date).toBe('2026-10-25');
  expect(rates[0]!.nightlyPrices[119]!.date).toBe('2027-02-21');
});
it('never silently substitutes a catalog for an unsupported fixture identity',()=>{
  expect(fixtures.catalogForIdentity('foundation-v1','foundation-catalog-v1').cities).toEqual([]);
  expect(()=>fixtures.catalogForIdentity('showcase-v1','foundation-catalog-v1')).toThrow(/version/i);
  expect(()=>fixtures.catalogForIdentity('future-v1','catalog-v1')).toThrow(/version/i);
  const first=fixtures.catalogForIdentity('showcase-v1','catalog-v1');first.cities.length=0;
  expect(fixtures.catalogForIdentity('showcase-v1','catalog-v1').cities).toHaveLength(22);
});
