import {createHash} from 'node:crypto';
import {DemoScenarioSchema,CreateDemoSessionInputSchema,TransportSearchQuerySchema,type RawProviderRecord} from '@torob-ticket/contracts';
import {localDateAt} from '@torob-ticket/domain';
import {dayOffset} from './calendar';
import {cities} from './catalog/cities';
import {connections} from './catalog/connections';
import {classChoices,providers} from './catalog/providers';
import {fixtureIdentity,fixtureSourceRevision} from './identity';
import {appendAirportTransfer,journey,servicesPerRoute,withDeparturePlace} from './schedules';
import {rawShape} from './raw-shapes';
import type {FixtureQuery} from './fixture-query';
import {generateProviderRecords as legacyRecords} from './legacy-v1/generator';
import {generateProviderRecords as previousRecords} from './legacy-v2/generator';
import {adultFareRial} from './catalog/pricing';
import {flightProfile} from './catalog/flight-profiles';
export type {FixtureQuery} from './fixture-query';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Deterministic source inventory. Optional seller projection avoids regenerating other sellers
 * during each adapter operation; it does not change any returned record or source identity. */
export function generateProviderRecords(input:FixtureQuery,providerId?:string):RawProviderRecord[] {
 if(input.fixtureVersion==='showcase-v1'||input.fixtureVersion==='showcase-v2'){
  const source=input.fixtureVersion==='showcase-v1'?legacyRecords:previousRecords;
  const records=source(input as Parameters<typeof legacyRecords>[0]);
  return providerId?records.filter(record=>record.providerId===providerId):records;
 }
 if(input.fixtureVersion!==fixtureIdentity.fixtureVersion)throw new RangeError('Unsupported fixture version');
 if(!Number.isSafeInteger(input.seed)||input.seed<0)throw new RangeError('Invalid fixture seed');
 if(!input.mappingRevision||!input.scenarioRevision)throw new RangeError('Missing revision');
 const anchor=CreateDemoSessionInputSchema.parse({anchorInstant:input.anchorInstant}).anchorInstant!;
 const scenario=DemoScenarioSchema.parse(input.scenario),query=TransportSearchQuerySchema.parse(input.query);
 const connection=connections.find(c=>c.mode===query.mode&&c.scope===query.scope&&c.originCityId===query.originCityId&&c.destinationCityId===query.destinationCityId);
 if(!connection)throw new RangeError('Unsupported route');
 const origin=cities.find(c=>c.id===query.originCityId)!,destination=cities.find(c=>c.id===query.destinationCityId)!;
 const offset=dayOffset(query.departureDate,localDateAt(anchor,origin.timeZone));
 const returnOffset=query.returnDate?dayOffset(query.returnDate,localDateAt(anchor,destination.timeZone)):undefined;
 if(offset<0||offset>89||returnOffset!==undefined&&(returnOffset<0||returnOffset>89))throw new RangeError('Date outside coverage');
 if(!classChoices.some(c=>c.mode===query.mode&&c.code===query.classCode))throw new RangeError('Unsupported class');
 if(query.party.children&&!query.party.childAges||query.party.infants&&!query.party.infantAgesMonths)throw new RangeError('AGE_REQUIRED');
 if(scenario==='no-eligible-results'||input.caseId==='no-timetable')return[];
 const back=connections.find(c=>c.mode===query.mode&&c.originCityId===query.destinationCityId&&c.destinationCityId===query.originCityId)!;
 const jitter=Number.parseInt(digest([input.seed,query.mode,query.originCityId,query.destinationCityId,query.departureDate]).slice(0,6),16)%5;
 const selectedProviders=providers.filter(p=>p.modes.includes(query.mode)&&(!providerId||p.providerId===providerId));
 if(!selectedProviders.length)return[];
 const services=Array.from({length:servicesPerRoute},(_,variant)=>{
  const outbound=journey(connection,query.departureDate,variant,false,query.classCode);
  const inbound=query.returnDate?journey(back,query.returnDate,variant,true,query.classCode):undefined;
  if(input.caseId==='airport-change'&&outbound.segments.at(-1)?.destinationPlaceId==='ist'){
   appendAirportTransfer(outbound,'ist','saw');if(inbound?.segments[0])inbound.segments[0]=withDeparturePlace(inbound.segments[0],'saw');
  }
  return{variant,outbound,inbound,baseFare:adultFareRial(query,variant)};
 }).filter(service=>!service.inbound||Date.parse(service.inbound.segments[0]!.departureAt)>Date.parse(service.outbound.segments.at(-1)!.arrivalAt));
 const records:RawProviderRecord[]=[];
 for(const provider of selectedProviders){
  const p=Number(provider.providerId.slice(-2));
  for(const {variant,outbound,inbound,baseFare}of services){
   const serviceKey=`${query.mode}:${query.originCityId}:${query.destinationCityId}:${query.departureDate}:${query.returnDate??'one-way'}:${variant}`;
   const partyWeight=query.party.adults*100+query.party.children*70+query.party.infants*10;
   const change=scenario==='price-change'&&input.phase==='recheck'&&p===4&&variant===0?130:100;
   const discontinuity=input.caseId==='discontinuous-price'?160:100;
   const unitGross=Math.round(baseFare*(96+p+jitter)/100*(inbound?1.82:1)*change/100*discontinuity/100/1000)*1000;
   const amountRial=unitGross*partyWeight/100;
   const unit=input.caseId==='ambiguous-unit'?'rial/toman':['IRR','تومان','ریال','TOMAN','IRR','تومان'][p-1]!;
   const divisor=unit==='TOMAN'||unit==='تومان'?10:1;
   const incomplete=input.caseId==='unknown-fees'||scenario==='conflicting-data'&&(variant===2&&(p===3||p===5)||p===2&&variant===0);
   const distant=query.mode==='flight'&&Boolean(flightProfile(query.originCityId,query.destinationCityId));
   const railConnector=query.mode==='train'&&outbound.segments.some(segment=>segment.mode==='bus');
   const materialTerms=railConnector?['بخش ایرانی مطابق کلاس انتخاب‌شده؛ نوع صندلی یا کوپه بخش‌های ترکیه ممکن است متفاوت باشد.','اتصال زمینی بین ایستگاه‌های وان و تاتوان در همین قیمت عرضه شده است.','حفاظت اتصال، انتقال بار، پذیرایی و جریمه لغو اعلام نشده است.']:distant?['حفاظت اتصال و انتقال بار بین شرکت‌ها اعلام نشده است.','میزان بار این ترکیب اعلام نشده است.','شرایط هر بخش مسیر را پیش از ادامه بررسی کنید.']:query.mode==='train'?['نوع کوپه یا صندلی مطابق کلاس انتخاب‌شده است.','جزئیات پذیرایی، حفاظت اتصال و جریمه لغو اعلام نشده است.']:query.mode==='bus'?['نوع صندلی مطابق کلاس انتخاب‌شده است.','میزان بار و جریمه لغو اعلام نشده است.']:outbound.stops.some(stop=>stop.vehicleChange)?['حفاظت اتصال و انتقال بار اعلام نشده است.']:[];
   const limited=input.caseId==='limited-stock'&&variant===2;
   const payload=rawShape(p,{materialTerms,serviceKey,outbound,inbound:input.caseId==='incomplete-round-trip'?undefined:inbound,originAlias:scenario==='conflicting-data'&&p===4&&variant===0?origin.name+' مرکزی':p===2?'  '+origin.name.replace(/ی/g,'ي').replace(/ک/g,'ك')+'  ':origin.name,destinationAlias:destination.name,classCode:query.classCode,value:amountRial/divisor,unit,mandatoryFees:incomplete?null:120000*(query.party.adults+query.party.children)/divisor,baggageKg:p===2||query.mode!=='flight'||distant||outbound.stops.some(stop=>stop.vehicleChange)?null:p===4?30:20,refundable:p===3?null:p===4||variant%3===1,available:!(scenario==='sold-out'&&input.phase==='recheck'&&p===4&&variant===0),seats:limited?1:12+variant%5*3,party:{adults:query.party.adults,children:query.party.children,infants:query.party.infants},revision:{fixtureVersion:input.fixtureVersion,mappingRevision:input.mappingRevision,sourceRevision:fixtureSourceRevision(input.fixtureVersion)}});
   records.push({rawRecordId:`raw-${digest([input,provider.providerId,variant]).slice(0,32)}`,providerId:provider.providerId,sourceNamespace:`${provider.providerId}/v1`,observedAt:new Date(anchor).toISOString(),fixtureVersion:input.fixtureVersion,payload:JSON.parse(JSON.stringify(payload))});
  }
 }
 if(input.caseId==='duplicate'&&records[0]&&records[0].providerId===providers.find(provider=>provider.modes.includes(query.mode))?.providerId)records.push({...records[0],rawRecordId:records[0].rawRecordId+'-duplicate',payload:structuredClone(records[0].payload)});
 return records;
}
