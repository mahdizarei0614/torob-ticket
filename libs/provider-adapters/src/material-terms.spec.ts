import {expect,it} from 'vitest';
import {catalog,catalogForIdentity,fixtureIdentity,generateProviderRecords,type FixtureQuery} from '@torob-ticket/fixtures';
import {normalizeRecord} from '@torob-ticket/domain';
import {decodeRawRecord} from './raw-codecs';
const paths=['terms.materialTerms','ticket.conditions','options.materialTerms','rules.materialTerms','conditions.materialTerms','attributes.0.materialTerms'];
function input(provider:number):FixtureQuery{return{...fixtureIdentity,seed:49,anchorInstant:'2026-10-29T00:00:00Z',scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',query:{mode:provider>4?'train':'flight',scope:'domestic',originCityId:'tehran',destinationCityId:'mashhad',tripType:'one-way',departureDate:'2026-11-01',party:{adults:1,children:0,infants:0},classCode:provider>4?'sleeper-4':'economy',filters:{},sort:'cheapest'}};}
it.each([1,2,3,4,5,6])('P0%i preserves explicit source unknowns without inventing terms for frozen old records',provider=>{
 const request=input(provider),raw=generateProviderRecords(request).find(record=>record.providerId===`demo-provider-0${provider}`)!;
 const fields=paths[provider-1]!.split('.');let holder=raw.payload as Record<string,unknown>;
 for(const key of fields.slice(0,-1))holder=holder[key] as Record<string,unknown>;
 const key=fields.at(-1)!,terms=['حفاظت اتصال اعلام نشده است.','انتقال بار اعلام نشده است.'];holder[key]=terms;
 const before=JSON.stringify(raw),decoded=decodeRawRecord(raw),context={query:request.query,catalog,mappingRevision:'mapping-v1',aliases:[],realClock:{now:()=>new Date(request.anchorInstant)}};
 const normalized=normalizeRecord(decoded,context);expect(normalized.trace.outcome).toBe('accepted');expect(normalized.offer!.conditions.outbound.materialTerms).toEqual(terms);
 normalized.offer!.conditions.outbound.materialTerms.push('consumer-local mutation');expect(JSON.stringify(raw)).toBe(before);expect(decoded.materialTerms).toEqual(terms);
 holder[key]=[''];expect(()=>decodeRawRecord(raw)).toThrow(/MALFORMED_RAW/);
 const oldInput={...request,fixtureVersion:'showcase-v1'},old=generateProviderRecords(oldInput).find(record=>record.providerId===raw.providerId)!,legacy=decodeRawRecord(old);
 const oldContext={...context,catalog:catalogForIdentity('showcase-v1','catalog-v1')};
 expect(JSON.stringify(normalizeRecord(legacy,oldContext))).toBe(JSON.stringify(normalizeRecord({...legacy,materialTerms:[]},oldContext)));
 expect(normalizeRecord(legacy,oldContext).offer!.conditions.outbound.materialTerms).toEqual([]);
});
