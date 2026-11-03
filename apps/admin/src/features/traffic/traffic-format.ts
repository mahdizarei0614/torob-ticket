import {parseDate} from '@internationalized/date';
import {UpdateProviderTariffSchema,type ProviderTariff,type UpdateProviderTariff} from '@torob-ticket/contracts';

const integer=new Intl.NumberFormat('en-GB');
const toman=new Intl.NumberFormat('en-GB',{maximumFractionDigits:1});
const months=['Farvardin','Ordibehesht','Khordad','Tir','Mordad','Shahrivar','Mehr','Aban','Azar','Dey','Bahman','Esfand'];
export const count=(value:number)=>integer.format(value);
export const fee=(rial:number)=>`${toman.format(rial/10)} toman`;
export const trafficStamp=(value:string)=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(value));
export function monthLabel(key:string){const[year,month]=key.split('-');return `${months[Number(month)-1]??month} ${year}`;}
export function previousMonth(key:string){const[y,m]=key.split('-').map(Number);return m===1?`${y!-1}-12`:`${y}-${String(m!-1).padStart(2,'0')}`;}
export function dayLabel(day:string){return new Intl.DateTimeFormat('en-GB',{month:'short',day:'numeric',timeZone:'Asia/Tehran'}).format(parseDate(day).toDate('Asia/Tehran'));}
export interface TariffDraftRow {upTo:string;rateToman:string}
export function tariffDraft(tariff:ProviderTariff):TariffDraftRow[]{return tariff.tiers.map(tier=>({upTo:tier.upTo===null?'':String(tier.upTo),rateToman:tier.rateRial===null?'':`${Math.floor(tier.rateRial/10)}${tier.rateRial%10?'.'+tier.rateRial%10:''}`}));}
/** Parse decimal text as integer rial, rather than rounding a floating fee. */
export function parseToman(value:string):number|null {
 const text=value.trim();if(!text)return null;
 if(!/^(0|[1-9]\d*)(\.\d)?$/.test(text))throw new Error('Enter a non-negative toman amount with at most one decimal place.');
 const[whole,fraction='0']=text.split('.');const rial=BigInt(whole!)*10n+BigInt(fraction);
 if(rial>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('This rate is too large.');
 return Number(rial);
}
export function parseTariffDraft(baseRevision:string,rows:TariffDraftRow[]):UpdateProviderTariff{
 const tiers=rows.map((row,index)=>{
  const upTo=index===rows.length-1?null:/^[1-9]\d*$/.test(row.upTo.trim())?Number(row.upTo):NaN;
  return {upTo,rateRial:parseToman(row.rateToman)};
 });
 const parsed=UpdateProviderTariffSchema.safeParse({baseRevision,tiers});
 if(!parsed.success)throw new Error('Checkpoints must be positive whole numbers in increasing order, followed by the unlimited tier.');
 return parsed.data;
}
/** The visible through date is inclusive; the server boundary is exclusive. */
export function customRange(from:string,through:string){
 if(!from&&!through)return {};
 if(!from||!through)throw new Error('Choose both dates for the custom range.');
 const start=parseDate(from),end=parseDate(through);if(start.compare(end)>0)throw new Error('The through date must be on or after the from date.');
 return {from:start.toDate('Asia/Tehran').toISOString(),to:end.add({days:1}).toDate('Asia/Tehran').toISOString()};
}
