import {createHash} from 'node:crypto';
import {CalendarDate,PersianCalendar} from '@internationalized/date';
import type {Mode,ProviderTariff} from '@torob-ticket/contracts';
import {persianMonth,referralCharge} from './provider-billing';

export const TRAFFIC_ACTIVITY_VERSION='traffic-activity-v1';
export const TRAFFIC_ACTIVITY_MARKER='traffic-activity-v1-import';
export const activityId=(kind:string,...parts:unknown[])=>'activity-'+kind+'-'+createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0,32);
const integer=(...parts:unknown[])=>parseInt(createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0,8),16);
export interface ActivityVisit {id:string;providerId:string;visitorKey:string;kind:'transport'|'hotel';mode:Mode;at:Date;monthKey:string;ordinal:number|null;rateRial:number|null;tierIndex:number|null;billable:boolean;tariff:ProviderTariff;templateKey:string}
export interface TrafficActivityPlan {visits:ActivityVisit[];tariffs:ProviderTariff[];monthKeys:string[];generatedAt:Date}
/** Authored history, never evidence that a live provider received an HTTP request. */
export function trafficActivityPlan(now:Date,providers:readonly {providerId:string;modes:Mode[]}[]):TrafficActivityPlan {
 const current=persianMonth(now),[year,month]=current.key.split('-').map(Number);
 const periods=[2,1,0].map(offset=>{const day=new CalendarDate(new PersianCalendar(),year!,month!,1).subtract({months:offset});return persianMonth(now,`${day.year}-${String(day.month).padStart(2,'0')}`);});
 const target=[1264,612,248,92,59,36];
 const tariffs=providers.map((provider,index)=>({providerId:provider.providerId,revision:activityId('tariff',provider.providerId),tiers:[{upTo:100,rateRial:2500+index*300},{upTo:1000,rateRial:4000+index*400},{upTo:null,rateRial:6500+index*500}],updatedAt:periods[0]!.from.toISOString()}));
 const planned:{providerId:string;visitorKey:string;kind:'transport'|'hotel';mode:Mode;at:Date;id:string}[]=[];
 for(const [periodIndex,period] of periods.entries()){
  const end=Math.min(period.to.getTime(),now.getTime()-1000),span=end-period.from.getTime();if(span<=0)continue;
  for(const [providerIndex,provider] of providers.entries()){
   const count=Math.round((target[providerIndex]??36)*(periodIndex===0?.77:periodIndex===1?1.13:1));
   for(let i=0;i<count;i++){
    // Quantiles with bounded jitter keep all days active. Local evening demand
    // is denser than overnight demand, with deterministic day-to-day variation.
    const fraction=(i+.15+(integer(providerIndex,periodIndex,i)%700)/1000)/count;
    let at=new Date(period.from.getTime()+Math.floor(fraction*span));
    const local=new Date(at.getTime()+12600000),hour=local.getUTCHours();
    if(hour<6){const shifted=at.getTime()+(7-hour)*3600000;if(shifted<end)at=new Date(shifted);}
    const visitorKey=activityId('visitor',(i+providerIndex*23)%Math.max(32,Math.ceil(count*.71)));
    const kind=i%5===0?'hotel' as const:'transport' as const,mode=provider.modes[i%provider.modes.length]!;
    const base={providerId:provider.providerId,visitorKey,kind,mode};
    planned.push({...base,at,id:activityId('visit',period.key,provider.providerId,i,0)});
    if(i%7===0&&at.getTime()+10*60000<end)planned.push({...base,at:new Date(at.getTime()+10*60000),id:activityId('visit',period.key,provider.providerId,i,1)});
    if(i%29===0&&at.getTime()+35*60000<end)planned.push({...base,at:new Date(at.getTime()+35*60000),id:activityId('visit',period.key,provider.providerId,i,2)});
   }
  }
 }
 planned.sort((a,b)=>a.at.getTime()-b.at.getTime()||a.id.localeCompare(b.id));
 const last=new Map<string,Date>(),ordinals=new Map<string,number>();
 const visits=planned.map(visit=>{
  const monthKey=persianMonth(visit.at).key,key=visit.providerId+':'+visit.visitorKey,ordinalKey=visit.providerId+':'+monthKey;
  const supplied=tariffs.find(tariff=>tariff.providerId===visit.providerId)!;
  // The first month's early traffic predates the first pricing agreement.
  const unpriced=monthKey===periods[0]!.key&&visit.at.getTime()<periods[0]!.from.getTime()+3*86400000;
  const tariff:ProviderTariff=unpriced?{...supplied,revision:activityId('unpriced',visit.providerId),tiers:supplied.tiers.map(tier=>({...tier,rateRial:null})),updatedAt:null}:supplied;
  const charge=referralCharge(visit.at,last.get(key)??null,(ordinals.get(ordinalKey)??0)+1,tariff);
  if(charge.billable){last.set(key,visit.at);ordinals.set(ordinalKey,charge.monthOrdinal);}
  return {...visit,monthKey,ordinal:charge.monthOrdinal,rateRial:charge.rateRial,tierIndex:charge.tierIndex,billable:charge.billable,tariff,templateKey:activityId('template',visit.providerId,visit.kind,visit.mode,Math.floor(visit.at.getTime()/600000))};
 });
 return {visits,tariffs,monthKeys:periods.map(period=>period.key),generatedAt:now};
}
