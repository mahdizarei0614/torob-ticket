import {describe,expect,it} from 'vitest';
import {trafficActivityPlan} from './traffic-activity-plan';
import {persianMonth} from './provider-billing';

const providers=Array.from({length:6},(_,i)=>({providerId:`provider-${i}`,modes:['flight','train','bus'] as const})).map(p=>({...p,modes:[...p.modes]}));
const now=new Date('2026-11-07T08:00:00Z');

describe('authored referral activity plan',()=>{
 it('is deterministic, bounded, chronological and confined to three Persian months',()=>{
  const plan=trafficActivityPlan(now,providers),repeat=trafficActivityPlan(now,providers);
  expect(repeat).toEqual(plan);
  expect(plan.visits.length).toBeGreaterThan(6000);expect(plan.visits.length).toBeLessThan(10000);
  expect(plan.monthKeys).toHaveLength(3);expect(plan.monthKeys.at(-1)).toBe(persianMonth(now).key);
  expect(new Set(plan.visits.map(v=>v.id)).size).toBe(plan.visits.length);
  for(const [i,v] of plan.visits.entries()){
   expect(v.at.getTime()).toBeLessThan(now.getTime());expect(v.at.getTime()).toBeGreaterThanOrEqual(persianMonth(now,plan.monthKeys[0]).from.getTime());
   expect(persianMonth(v.at).key).toBe(v.monthKey);expect(plan.monthKeys).toContain(v.monthKey);
   if(i)expect(v.at.getTime()).toBeGreaterThanOrEqual(plan.visits[i-1]!.at.getTime());
  }
 });
 it('matches independent rolling-hour anchors, monthly ordinals and graduated tier arithmetic',()=>{
  const plan=trafficActivityPlan(now,providers),last=new Map<string,number>(),ordinals=new Map<string,number>();
  for(const v of plan.visits){
   const key=v.providerId+':'+v.visitorKey,month=v.providerId+':'+v.monthKey,previous=last.get(key);
   const eligible=previous===undefined||v.at.getTime()-previous>=3600000;
   expect(v.billable).toBe(eligible);
   if(!eligible){expect([v.ordinal,v.rateRial,v.tierIndex]).toEqual([null,null,null]);continue;}
   const ordinal=(ordinals.get(month)??0)+1,index=ordinal<=100?0:ordinal<=1000?1:2;
   expect(v.ordinal).toBe(ordinal);expect(v.tierIndex).toBe(index);expect(v.rateRial).toBe(v.tariff.tiers[index]!.rateRial);
   last.set(key,v.at.getTime());ordinals.set(month,ordinal);
  }
  expect([...ordinals.values()].some(n=>n>1000)).toBe(true);
  expect(plan.visits.some(v=>!v.billable)).toBe(true);
 });
 it('keeps unknown historical rates and shared visitors distinct from fees and provider counts',()=>{
  const plan=trafficActivityPlan(now,providers);
  expect(plan.visits.some(v=>v.billable&&v.rateRial===null)).toBe(true);
  expect(plan.visits.some(v=>v.billable&&v.rateRial!==null)).toBe(true);
  expect(new Set(plan.visits.map(v=>v.kind))).toEqual(new Set(['transport','hotel']));
  const unique=new Set(plan.visits.map(v=>v.visitorKey)).size;
  const providerUnique=providers.reduce((n,p)=>n+new Set(plan.visits.filter(v=>v.providerId===p.providerId).map(v=>v.visitorKey)).size,0);
  expect(unique).toBeLessThan(providerUnique);
 });
 it('handles a Persian year boundary and a just-started month without inventing future visits',()=>{
  for(const instant of ['2027-03-21T00:00:00Z','2026-10-22T20:30:00.001Z']){
   const at=new Date(instant),plan=trafficActivityPlan(at,providers);
   expect(plan.monthKeys).toHaveLength(3);expect(new Set(plan.monthKeys).size).toBe(3);
   expect(plan.monthKeys.at(-1)).toBe(persianMonth(at).key);
   expect(plan.visits.every(v=>v.at.getTime()<at.getTime()&&plan.monthKeys.includes(v.monthKey))).toBe(true);
  }
 });
});
