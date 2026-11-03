import {describe,expect,it} from 'vitest';
import {customRange,parseTariffDraft,parseToman,previousMonth,tariffDraft} from './traffic-format';

describe('referral fee editing boundaries',()=>{
 it('keeps an unset rate distinct from a deliberate free tier and converts decimal toman exactly',()=>{
  expect(parseToman('')).toBeNull();expect(parseToman('0')).toBe(0);expect(parseToman('100.1')).toBe(1001);
  expect(parseToman('900719925474099.1')).toBe(Number.MAX_SAFE_INTEGER);
  for(const value of ['1.01','-1','1e3','NaN','900719925474099.2'])expect(()=>parseToman(value)).toThrow();
 });
 it('preserves rate precision when editing and rejects duplicate or descending checkpoints',()=>{
  const tariff={providerId:'p',revision:'r',updatedAt:null,tiers:[{upTo:100,rateRial:null},{upTo:1000,rateRial:0},{upTo:null,rateRial:12345}]};
  expect(parseTariffDraft('r',tariffDraft(tariff))).toEqual({baseRevision:'r',tiers:tariff.tiers});
  expect(()=>parseTariffDraft('r',[{upTo:'100',rateToman:'1'},{upTo:'100',rateToman:'2'},{upTo:'',rateToman:''}])).toThrow(/increasing/);
  expect(()=>parseTariffDraft('r',[{upTo:'200',rateToman:'1'},{upTo:'100',rateToman:'2'},{upTo:'',rateToman:''}])).toThrow(/increasing/);
 });
 it('uses inclusive Tehran calendar dates with an exclusive next-day server boundary',()=>{
  expect(customRange('2026-11-03','2026-11-03')).toEqual({from:'2026-11-02T20:30:00.000Z',to:'2026-11-03T20:30:00.000Z'});
  expect(customRange('','')).toEqual({});
  expect(()=>customRange('2026-11-03','')).toThrow(/both dates/);
  expect(()=>customRange('2026-11-04','2026-11-03')).toThrow(/on or after/);
  expect(previousMonth('1405-01')).toBe('1404-12');
 });
});
