import {CalendarDate,PersianCalendar,fromDate,toCalendar,toCalendarDate} from '@internationalized/date';
import type {ProviderTariff} from '@torob-ticket/contracts';
export const BILLING_ZONE='Asia/Tehran';
export const REFERRAL_WINDOW_MS=60*60*1000;
export function persianMonth(now:Date,key?:string){
 const local=toCalendar(fromDate(now,BILLING_ZONE),new PersianCalendar());
 const parts=key?.split('-').map(Number),year=parts?.[0]??local.year,month=parts?.[1]??local.month;
 if(!Number.isInteger(year)||year<1300||year>1600||!Number.isInteger(month)||month<1||month>12)throw new RangeError('Unsupported billing month');
 const start=new CalendarDate(new PersianCalendar(),year,month,1),end=start.add({months:1});
 return {key:`${year}-${String(month).padStart(2,'0')}`,from:start.toDate(BILLING_ZONE),to:end.toDate(BILLING_ZONE)};
}
export function localTrafficDate(date:Date){return toCalendarDate(fromDate(date,BILLING_ZONE)).toString();}
export function trafficDayKeys(from:Date,to:Date){let day=toCalendarDate(fromDate(from,BILLING_ZONE));const keys:string[]=[];while(day.toDate(BILLING_ZONE)<to){keys.push(day.toString());day=day.add({days:1});}return keys;}
export function referralCharge(now:Date,lastBillable:Date|null,ordinal:number,tariff:ProviderTariff){
 if(lastBillable&&now.getTime()-lastBillable.getTime()<REFERRAL_WINDOW_MS)return {billable:false as const,reason:'repeat-within-hour' as const,monthOrdinal:null,rateRial:null,tierIndex:null};
 if(!Number.isSafeInteger(ordinal)||ordinal<1)throw new RangeError('Unsafe billing ordinal');
 const tierIndex=tariff.tiers.findIndex(tier=>tier.upTo===null||ordinal<=tier.upTo);
 if(tierIndex<0)throw new RangeError('Tariff is not unbounded');
 return {billable:true as const,reason:'eligible' as const,monthOrdinal:ordinal,rateRial:tariff.tiers[tierIndex]!.rateRial,tierIndex};
}
export function safeTrafficInteger(value:unknown){const exact=BigInt(String(value));if(exact<0n||exact>BigInt(Number.MAX_SAFE_INTEGER))throw new RangeError('Traffic total exceeds supported exact integer range');return Number(exact);}
