import {describe,expect,it} from 'vitest';
import {fixtureBundles} from '@torob-ticket/fixtures';
import {trafficActivityPlan} from '@torob-ticket/data-access';
import {trafficActivitySources} from './traffic-activity-sources';

describe('activity source compatibility',()=>{
 for(const bundle of fixtureBundles)it('builds coherent transport and hotel sources for '+bundle.identity.fixtureVersion,async()=>{
  const full=trafficActivityPlan(new Date('2026-11-07T08:00:00Z'),bundle.catalog.providerCapabilities);
  const sources=await trafficActivitySources(full,bundle.catalog,'mapping-v1'),byKey=new Map(sources.map(s=>[s.key,s]));
  expect(sources).toHaveLength(new Set(full.visits.map(v=>v.templateKey)).size);
  expect(new Set(sources.map(s=>s.searchId)).size).toBe(sources.length);expect(new Set(sources.map(s=>s.payload.quote.quoteId)).size).toBe(sources.length);
  for(const visit of full.visits){
   const source=byKey.get(visit.templateKey)!;expect(source).toBeTruthy();
   expect(source.payload.quote.providerId).toBe(visit.providerId);expect(source.payload.quote.provenance.every(p=>p.fixtureVersion===bundle.identity.fixtureVersion)).toBe(true);
   expect(Date.parse(source.payload.quote.observedAt)).toBeLessThanOrEqual(visit.at.getTime());expect(Date.parse(source.payload.quote.expiresAt)).toBeGreaterThan(visit.at.getTime());
  }
 },45000);
});
