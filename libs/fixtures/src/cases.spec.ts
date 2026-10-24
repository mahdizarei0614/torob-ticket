import { expect,it } from 'vitest';
import * as fixtures from './index';
const lookup=(fixtures as unknown as {fixtureCase?:(id:string)=>{id:string;focus:number;ownerTasks:string[];inputs:unknown[];records:unknown[][];events:unknown[];environment?:unknown}}).fixtureCase;
it('provides deterministic underlying data for all five Review Focus classes',()=>{
  const cases=['local-midnight','jalali-boundary','overnight','same-day-return','late-query','reconnect-frozen','mixed-units','missing-fees','airport-change','different-class','missing-baggage','incomplete-round-trip','hotel-occupancy','reviewer-isolation','repeated-click','stale-intent','context-loss','reduced-motion','small-screen','modal-canvas'];
  expect(typeof lookup).toBe('function');
  const covered=new Set<number>();
  for(const id of cases){const item=lookup!(id);expect(item).toEqual(lookup!(id));expect(item.ownerTasks.length).toBeGreaterThan(0);expect(item.records.flat().length).toBeGreaterThan(0);covered.add(item.focus);}
  expect([...covered].sort()).toEqual([1,2,3,4,5]);
  expect(()=>lookup!('not-a-case')).toThrow(/unknown/i);
});
it('hotel occupancy case carries real materialized rates as downstream evidence',()=>{
  const item=lookup!('hotel-occupancy') as unknown as {hotelRates?:{maxAdults:number;maxChildren:number;nightlyPrices:unknown[]}[]};
  expect(item.hotelRates?.some(r=>r.maxAdults===1&&r.maxChildren===0)).toBe(true);
  expect(item.hotelRates?.[0]?.nightlyPrices).toHaveLength(120);
});
it('repeated click case carries two deliveries with the same intent identity',()=>{
  const item=lookup!('repeated-click');expect(item.events).toHaveLength(2);
  expect(item.events[0]).toMatchObject({kind:'confirm',sourceId:'click-a-1'});
  expect(item.events[1]).toMatchObject({kind:'confirm',sourceId:'click-a-1'});
});
