import { describe, expect, it } from 'vitest';
import type { DecodedProviderRecord, NormalizationContext } from './normalization-types';
import { normalizeRecord } from './normalize';
import { cleanAlias, resolveAlias } from './aliases';
const clock={now:()=>new Date('2026-10-25T12:00:00Z')};
const place=(id:string,cityId:string)=>({id,cityId,name:id,kind:'airport' as const,timeZone:'Asia/Tehran',point:{latitude:35,longitude:51}});
const context:NormalizationContext={realClock:clock,mappingRevision:'m1',aliases:[],query:{mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-10-25',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'},catalog:{fixtureVersion:'f1',catalogRevision:'c1',cities:[{id:'tehran',name:'تهران',countryCode:'IR',timeZone:'Asia/Tehran',point:{latitude:35,longitude:51}},{id:'mashhad',name:'مشهد',countryCode:'IR',timeZone:'Asia/Tehran',point:{latitude:36,longitude:59}}],places:[place('thr','tehran'),place('ika','tehran'),place('mhd','mashhad')],supportedConnections:[],providerCapabilities:[],classChoices:[{code:'economy',mode:'flight',name:'Economy'}]}};
const record:DecodedProviderRecord={raw:{rawRecordId:'instance-1',providerId:'p1',sourceNamespace:'p1/v1',observedAt:'2026-10-24T00:00:00Z',fixtureVersion:'f1',payload:{original:'preserved'}},sourceRawRecordId:'source-1',serviceKey:'service-1',outbound:{segments:[{segmentId:'s1',serviceId:'dated-service',mode:'flight',operatorId:'op',originPlaceId:'thr',destinationPlaceId:'mhd',departureAt:'2026-10-25T05:00:00Z',arrivalAt:'2026-10-25T06:00:00Z',departureTimeZone:'Asia/Tehran',arrivalTimeZone:'Asia/Tehran'}],stops:[]},originAlias:' تهران ',destinationAlias:'مشهد',amount:'100000',unit:'تومان',mandatoryCharge:12000,classCode:'economy',baggageKg:null,refundable:null,available:true,seats:9,party:{adults:1,children:0,infants:0},sourceRevision:'v1',mappingRevision:'m1',fixtureVersion:'f1'};
describe('pure normalization with source provenance',()=>{
  it('keeps gross total and unknown conditions, linking every decision to source evidence',()=>{
    const result=normalizeRecord(record,context);
    expect(result.trace.outcome).toBe('accepted');
    expect(result.offer?.total?.amountRial).toBe(1000000);
    expect(result.offer?.breakdown.reduce((n,p)=>n+p.amount.amountRial,0)).toBe(1000000);
    expect(result.offer?.conditions.outbound).toMatchObject({checkedBaggageKg:{status:'unknown'},cabinBaggageKg:{status:'unknown'},refundable:{status:'unknown'},cancellation:{status:'unknown'},seatOrBerth:{status:'unknown'}});
    expect(result.offer?.itinerary.outbound.segments[0]?.serviceId).toBe('dated-service');
    expect(result.offer?.provenance[0]).toMatchObject({rawRecordId:'instance-1',sourceRevision:'v1',sourceValue:{sourceRawRecordId:'source-1'}});
    expect(result.trace.observedAt).toBe('2026-10-25T12:00:00.000Z');
    expect(result.offer?.observedAt).toBe('2026-10-24T00:00:00Z');
    expect(result.source?.pricingBasis).toBe('whole-party-gross');
  });
  it('preserves incomplete mandatory total without zero substitution',()=>{
    const result=normalizeRecord({...record,mandatoryCharge:null},context);
    expect(result.offer?.completeness).toEqual({status:'incomplete',missing:['mandatory-charge']});
    expect(result.offer?.total?.amountRial).toBe(1000000);
  });
  it.each(['rial/toman','USD'])('rejects ambiguous/unsupported money unit %s',unit=>{
    expect(normalizeRecord({...record,unit},context).trace.outcome).toBe('rejected');
  });
  it('does not resolve a collision just because one candidate matches the query',()=>{
    const aliases=[{entityType:'city' as const,sourceNamespace:'p1/v1',sourceValue:' تهران ',targetId:'mashhad'}];
    const result=normalizeRecord(record,{...context,aliases});
    expect(result.trace.outcome).toBe('ambiguous'); expect(result.offer).toBeUndefined();
  });
  it('canonicalizes spelling while preserving exact distinct place identifiers',()=>{
    expect(cleanAlias('  كيش  ي  ')).toBe('کیش ی');
    expect(resolveAlias('thr','p1/v1','place',context.catalog.places,[])).toEqual(['thr']);
    expect(resolveAlias('ika','p1/v1','place',context.catalog.places,[])).toEqual(['ika']);
    expect(resolveAlias('تهران','other','city',[],[{entityType:'place',sourceNamespace:'other',sourceValue:'تهران',targetId:'thr'}])).toEqual([]);
  });
  it('rejects missing return legs and impossible known mandatory fees',()=>{
    expect(normalizeRecord(record,{...context,query:{...context.query,tripType:'round-trip',returnDate:'2026-10-28'}}).trace.outcome).toBe('rejected');
    expect(normalizeRecord({...record,mandatoryCharge:200000},context).trace.outcome).toBe('rejected');
  });
  it('rejects mismatched segment modes and discontinuous supplied journeys',()=>{
    const modeRecord=structuredClone(record);modeRecord.outbound.segments[0]!.mode='train';
    expect(normalizeRecord(modeRecord,context).trace.outcome).toBe('rejected');
    const broken=structuredClone(record);broken.outbound.segments.push({...broken.outbound.segments[0]!,segmentId:'s2',serviceId:'later',departureAt:'2026-10-25T07:00:00Z',arrivalAt:'2026-10-25T08:00:00Z'});
    expect(normalizeRecord(broken,context).trace.outcome).toBe('rejected');
  });

});
