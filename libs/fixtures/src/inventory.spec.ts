import { describe,expect,it } from 'vitest';
import { JourneyLegSchema, RoomRateSchema, type JourneyLeg, type RawProviderRecord, type TransportSearchQuery } from '@torob-ticket/contracts';
import { localDateAt } from '@torob-ticket/domain';
import { catalog, connections, fixtureCase, fixtureIdentity, generateProviderRecords, heroSearches, hotels, materializeRoomRates, providers, roomRateTemplates, type FixtureQuery } from './index';
const base={...fixtureIdentity,seed:73,anchorInstant:'2026-10-24T00:00:00.000Z',scenario:'normal' as const,scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1'};
const defaultClass={flight:'economy',train:'sleeper-4',bus:'vip'};
function input(route:{mode:TransportSearchQuery['mode'];scope:TransportSearchQuery['scope'];originCityId:string;destinationCityId:string}):FixtureQuery{return {...base,query:{mode:route.mode,scope:route.scope,originCityId:route.originCityId,destinationCityId:route.destinationCityId,tripType:'round-trip',departureDate:'2026-10-24',returnDate:'2026-10-27',party:{adults:1,children:0,infants:0},classCode:defaultClass[route.mode],filters:{},sort:'cheapest'}};}
// Test-only structural inspection of authored evidence; no production decoder is introduced.
function objects(value:unknown):Record<string,unknown>[] {if(!value||typeof value!=='object')return [];if(Array.isArray(value))return value.flatMap(objects);return [value as Record<string,unknown>,...Object.values(value).flatMap(objects)];}
function legs(record:RawProviderRecord):JourneyLeg[]{return objects(record.payload).filter(o=>Array.isArray(o.segments)).map(o=>JourneyLegSchema.parse(o));}
function total(record:RawProviderRecord):number {const p=record.payload as Record<string,unknown>;const index=Number(record.providerId.slice(-2));const holder=objects(p).find(o=>index===1?'amount'in o:index===2?'price'in o:index===3?'payable'in o:index===4?'value'in o:index===5?'total'in o:'gross'in o)!;return Number(holder[['','amount','price','payable','value','total','gross'][index]!]);}

describe('all selectable graph edges have coherent fixture evidence',()=>{
  it.each(heroSearches)('$scope $mode $destinationCityId has multiple complete same-provider round trips and reverses',hero=>{
    for(const reverse of [false,true]){
      const records=generateProviderRecords(input({...hero,originCityId:reverse?hero.destinationCityId:'tehran',destinationCityId:reverse?'tehran':hero.destinationCityId}));
      expect(new Set(records.map(r=>r.providerId)).size).toBeGreaterThanOrEqual(3);
      for(const p of new Set(records.map(r=>r.providerId)))expect(records.filter(r=>r.providerId===p).length).toBeGreaterThanOrEqual(3);
      for(const record of records)expect(legs(record)).toHaveLength(2);
    }
  });
  it('every graph edge is selectable, reversible, supplied, and time-ordered',()=>{
    expect(connections.length).toBeGreaterThan(80);
    for(const route of connections){
      expect(catalog.supportedConnections).toContainEqual({mode:route.mode,scope:route.scope,originCityId:route.originCityId,destinationCityId:route.destinationCityId});
      expect(connections.some(r=>r.mode===route.mode&&r.scope===route.scope&&r.originCityId===route.destinationCityId&&r.destinationCityId===route.originCityId)).toBe(true);
      const records=generateProviderRecords(input(route));expect(records.length).toBeGreaterThanOrEqual(9);
      for(const record of records){expect(providers.find(p=>p.providerId===record.providerId)!.modes).toContain(route.mode);const journeyLegs=legs(record);expect(journeyLegs).toHaveLength(2);
        for(const leg of journeyLegs){for(const [i,s]of leg.segments.entries()){expect(catalog.places.some(p=>p.id===s.originPlaceId)).toBe(true);expect(catalog.places.some(p=>p.id===s.destinationPlaceId)).toBe(true);expect(Date.parse(s.arrivalAt)).toBeGreaterThan(Date.parse(s.departureAt));if(i>0)expect(Date.parse(s.departureAt)).toBeGreaterThanOrEqual(Date.parse(leg.segments[i-1]!.arrivalAt));}
          for(const stop of leg.stops)expect((Date.parse(stop.departureAt!)-Date.parse(stop.arrivalAt!))/60000).toBe(stop.waitMinutes);
        }
        expect(Date.parse(journeyLegs[1]!.segments[0]!.departureAt)).toBeGreaterThan(Date.parse(journeyLegs[0]!.segments.at(-1)!.arrivalAt));
      }
      expect(hotels.filter(h=>h.destinationCityId===route.destinationCityId).length).toBeGreaterThanOrEqual(12);
    }
  });
  it('shares authored itinerary identity across seller dialects and preserves heterogeneous conditions',()=>{
    const records=generateProviderRecords(input({...heroSearches[0]!,originCityId:'tehran'}));
    const first=records.filter((_,i)=>i%12===0);
    expect(new Set(first.map(r=>legs(r)[0]!.segments[0]!.serviceId)).size).toBe(1);
    expect(new Set(records.map(total)).size).toBeGreaterThan(4);
    expect(objects(records.find(r=>r.providerId==='demo-provider-02')!.payload).some(o=>o.luggage===null)).toBe(true);
    expect(objects(records.find(r=>r.providerId==='demo-provider-02')!.payload).some(o=>o.unit==='تومان')).toBe(true);
    expect(objects(records.findLast(r=>r.providerId==='demo-provider-03')!.payload).some(o=>o.fees===null)).toBe(false);
    const unknownFees=generateProviderRecords({...input({...heroSearches[0]!,originCityId:'tehran'}),caseId:'unknown-fees'});
    expect(objects(unknownFees.find(r=>r.providerId==='demo-provider-03')!.payload).some(o=>o.fees===null)).toBe(true);
  });
  it('prices the complete party and supplied round trip, never independent sellers',()=>{
    const q=input({...heroSearches[0]!,originCityId:'tehran'});
    const one=generateProviderRecords(q);const two=generateProviderRecords({...q,query:{...q.query,party:{adults:2,children:0,infants:0}}});
    expect(two.map(total)).toEqual(one.map(r=>total(r)*2));
    const way=generateProviderRecords({...q,query:{...q.query,tripType:'one-way',returnDate:undefined}});
    for(let i=0;i<one.length;i++){expect(total(one[i]!)).toBeGreaterThan(total(way[i]!));expect(total(one[i]!)).toBeLessThan(2*total(way[i]!));}
  });
  it('keeps overnight arrivals and permits only actually time-valid same-day returns',()=>{
    const overnight=fixtureCase('overnight').records[0]!;expect(overnight.some(r=>legs(r).some(l=>localDateAt(l.segments.at(-1)!.arrivalAt,l.segments.at(-1)!.arrivalTimeZone)>localDateAt(l.segments[0]!.departureAt,l.segments[0]!.departureTimeZone)))).toBe(true);
    const same=fixtureCase('same-day-return').records[0]!;expect(same.length).toBeGreaterThanOrEqual(3);
    for(const r of same){const [out,back]=legs(r);expect(Date.parse(back!.segments[0]!.departureAt)).toBeGreaterThan(Date.parse(out!.segments.at(-1)!.arrivalAt));}
  });
  it('changes only the selected rechecked quote and preserves actionable alternatives',()=>{
    const q=input({...heroSearches[0]!,originCityId:'tehran'});
    for(const scenario of ['price-change','sold-out']as const){const before=generateProviderRecords({...q,scenario});const after=generateProviderRecords({...q,scenario,phase:'recheck',scenarioRevision:'scenario-v2'});const changed=after.filter((r,i)=>JSON.stringify(r.payload)!==JSON.stringify(before[i]!.payload));expect(changed).toHaveLength(1);expect(changed[0]!.providerId).toBe('demo-provider-04');}
  });
  it('supplies explicit ground-transfer segments for the airport-change case',()=>{
    const records=fixtureCase('airport-change').records[0]!;
    expect(records.some(r=>legs(r).some(l=>l.segments.some(s=>s.mode==='bus')&&l.stops.some(s=>s.kind==='ground-transfer'&&s.vehicleChange)))).toBe(true);
  });
  it('materializes full hotel coverage without changing base payloads or erasing unknown terms',()=>{
    const serialized=JSON.stringify(roomRateTemplates);
    for(const city of catalog.cities){const rates=materializeRoomRates(base.anchorInstant,city.id);expect(rates).toHaveLength(42);for(const rate of rates){expect(RoomRateSchema.safeParse(rate).success).toBe(true);expect(rate.nightlyPrices).toHaveLength(120);expect(new Set(rate.nightlyPrices.map(n=>n.date)).size).toBe(120);}}
    expect(JSON.stringify(roomRateTemplates)).toBe(serialized);
    expect(roomRateTemplates.some(r=>r.maxAdults===1&&r.maxChildren===0)).toBe(true);expect(roomRateTemplates.some(r=>r.terms.fees.status==='incomplete')).toBe(true);
  });
});
it('includes a true overnight connection with a vehicle change and a midnight-crossing wait',()=>{
  const records=generateProviderRecords(input({...heroSearches[0]!,originCityId:'tehran'}));
  const connection=records.flatMap(legs).flatMap(l=>l.stops).find(s=>s.kind==='connection'&&s.vehicleChange&&localDateAt(s.departureAt!,'Asia/Tehran')>localDateAt(s.arrivalAt!,'Asia/Tehran'));
  expect(connection).toBeDefined();expect(connection?.waitMinutes).toBeGreaterThanOrEqual(120);
});

function assertStableSegmentIdentities(records: RawProviderRecord[]): void {
  const identities = new Map<string, unknown>();
  let reused = 0;
  for (const segment of records.flatMap(legs).flatMap(leg => leg.segments)) {
    const facts = {
      serviceId: segment.serviceId,
      mode: segment.mode,
      originPlaceId: segment.originPlaceId,
      destinationPlaceId: segment.destinationPlaceId,
      departureAt: segment.departureAt,
      arrivalAt: segment.arrivalAt,
    };
    if (identities.has(segment.segmentId)) {
      reused++;
      expect(facts, `Segment identity collision: ${segment.segmentId}`).toEqual(identities.get(segment.segmentId));
    } else identities.set(segment.segmentId, facts);
  }
  // The same service must still be recognized across multiple providers.
  expect(reused).toBeGreaterThan(0);
}

it('retains endpoints and UTC times for identical dated segment IDs across all query roles', () => {
  const records: RawProviderRecord[] = [];
  for (const route of connections) {
    const roundTrip = input(route);
    records.push(...generateProviderRecords(roundTrip));
    for (const departureDate of ['2026-10-24', '2026-10-27']) {
      records.push(...generateProviderRecords({
        ...roundTrip,
        query: { ...roundTrip.query, tripType: 'one-way', departureDate, returnDate: undefined },
      }));
    }
  }
  assertStableSegmentIdentities(records);
},20000);

it('distinguishes morning and evening service departures while preserving seller-independent identity', () => {
  const roundTrip = input({ ...heroSearches[0]!, originCityId: 'tehran' });
  const returnSegment = legs(generateProviderRecords(roundTrip)[0]!)[1]!.segments[0]!;
  const standalone = generateProviderRecords({
    ...roundTrip,
    query: { ...roundTrip.query, originCityId: 'mashhad', destinationCityId: 'tehran', tripType: 'one-way', departureDate: '2026-10-27', returnDate: undefined },
  });
  const morning = legs(standalone[0]!)[0]!.segments[0]!;
  expect(morning.departureAt).toBe('2026-10-26T20:30:00.000Z');
  expect(returnSegment.departureAt).toBe('2026-10-27T14:30:00.000Z');
  expect(morning.serviceId).not.toBe(returnSegment.serviceId);
  expect(morning.segmentId).not.toBe(returnSegment.segmentId);
  const sameServiceAcrossProviders = standalone.filter((_, index) => index % 12 === 0).map(record => legs(record)[0]!.segments[0]!);
  expect(new Set(sameServiceAcrossProviders.map(segment => segment.serviceId)).size).toBe(1);
  expect(new Set(sameServiceAcrossProviders.map(segment => segment.segmentId)).size).toBe(1);
});

it('retains stable ground-transfer and changed-airport identities across dates and service variants', () => {
  const airportCase = fixtureCase('airport-change').inputs[0]!;
  const records: RawProviderRecord[] = [];
  for (const departureDate of ['2026-10-24', '2026-10-25']) {
    const changed = { ...airportCase, query: { ...airportCase.query, departureDate } };
    records.push(...generateProviderRecords(changed));
    records.push(...generateProviderRecords({ ...changed, caseId: undefined }));
  }
  expect(records.flatMap(legs).flatMap(leg => leg.segments).filter(segment => segment.mode === 'bus').length).toBeGreaterThan(3);
  assertStableSegmentIdentities(records);
});
