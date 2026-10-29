import { createHash } from 'node:crypto';
import { DemoScenarioSchema, CreateDemoSessionInputSchema, TransportSearchQuerySchema, type RawProviderRecord } from '@torob-ticket/contracts';
import { localDateAt } from '@torob-ticket/domain';
import { dayOffset } from './calendar';
import { cities } from './catalog/cities';
import { connections } from './catalog/connections';
import { classChoices, providers } from './catalog/providers';
import { fixtureIdentity, fixtureSourceRevision } from './identity';
import { appendAirportTransfer, journey, withDeparturePlace } from './schedules';
import { rawShape } from './raw-shapes';
import type { FixtureQuery } from './fixture-query';
import { generateProviderRecords as legacyRecords } from './legacy-v1/generator';
import { adultFareRial } from './catalog/pricing';
import { flightProfile } from './catalog/flight-profiles';
export type { FixtureQuery } from './fixture-query';
const digest = (input:unknown)=>createHash('sha256').update(JSON.stringify(input)).digest('hex');
/** Pure fixture construction. Delivery, filtering, decoding, normalization and ranking have later owners. */
export function generateProviderRecords(input:FixtureQuery):RawProviderRecord[] {
  if(input.fixtureVersion==='showcase-v1')return legacyRecords(input);
  if(input.fixtureVersion!==fixtureIdentity.fixtureVersion) throw new RangeError('Unsupported fixture version');
  if(!Number.isSafeInteger(input.seed)||input.seed<0) throw new RangeError('Invalid fixture seed');
  if(!input.mappingRevision || !input.scenarioRevision) throw new RangeError('Missing revision');
  const anchor=CreateDemoSessionInputSchema.parse({anchorInstant:input.anchorInstant}).anchorInstant!;
  const scenario=DemoScenarioSchema.parse(input.scenario);
  const query=TransportSearchQuerySchema.parse(input.query);
  const connection=connections.find(c=>c.mode===query.mode&&c.scope===query.scope&&c.originCityId===query.originCityId&&c.destinationCityId===query.destinationCityId);
  if(!connection) throw new RangeError('Unsupported route');
  const origin=cities.find(c=>c.id===query.originCityId)!;
  const destination=cities.find(c=>c.id===query.destinationCityId)!;
  const anchorDate=localDateAt(anchor,origin.timeZone);
  const offset=dayOffset(query.departureDate,anchorDate);
  const returnOffset=query.returnDate?dayOffset(query.returnDate,localDateAt(anchor,destination.timeZone)):undefined;
  if(offset<0||offset>89||returnOffset!==undefined&&(returnOffset<0||returnOffset>89)) throw new RangeError('Date outside coverage');
  if(!classChoices.some(c=>c.mode===query.mode&&c.code===query.classCode)) throw new RangeError('Unsupported class');
  if(query.party.children && !query.party.childAges || query.party.infants && !query.party.infantAgesMonths) throw new RangeError('AGE_REQUIRED');
  // Explicit discontinuities: day 6 then each 13th day has no authored timetable.
  if(scenario==='no-eligible-results'||offset%13===6||returnOffset!==undefined&&returnOffset%13===6) return [];
  const returnConnection=connections.find(c=>c.mode===query.mode&&c.originCityId===query.destinationCityId&&c.destinationCityId===query.originCityId)!;
  const records:RawProviderRecord[]=[];
  const jitter=Number.parseInt(digest([input.seed,query.mode,query.originCityId,query.destinationCityId,query.departureDate]).slice(0,6),16)%17;
  for(const provider of providers.filter(p=>p.modes.includes(query.mode))) {
    const p=Number(provider.providerId.slice(-2));
    for(let variant=0;variant<3;variant++) {
      const outbound=journey(connection,query.departureDate,variant,false,query.classCode);
      const inbound=query.returnDate?journey(returnConnection,query.returnDate,variant,true,query.classCode):undefined;
      if(inbound&&Date.parse(inbound.segments[0]!.departureAt)<=Date.parse(outbound.segments.at(-1)!.arrivalAt)) continue;
      const serviceKey=`${query.mode}:${query.originCityId}:${query.destinationCityId}:${query.departureDate}:${query.returnDate??'one-way'}:${variant}`;
      const baseFare=adultFareRial(query,variant);
      const partyWeight=query.party.adults*100+query.party.children*70+query.party.infants*10;
      const change=scenario==='price-change'&&input.phase==='recheck'&&p===4&&variant===0?130:100;
      const discontinuity=offset%11===5||input.caseId==='discontinuous-price'?160:100;
      const unitGross=Math.round(baseFare*(96+p+jitter%5)/100*(inbound?1.7:1)*change/100*discontinuity/100/1000)*1000;
      const amountRial=unitGross*partyWeight/100;
      const units=['IRR','تومان','ریال','TOMAN','IRR','تومان'];
      const unit=input.caseId==='ambiguous-unit'?'rial/toman':units[p-1]!;
      const divisor=unit==='TOMAN'||unit==='تومان'?10:1;
      const incomplete=variant===2&&(p===3||p===5)||scenario==='conflicting-data'&&p===2&&variant===0;
      if(input.caseId==='airport-change'&&outbound.segments.at(-1)?.destinationPlaceId==='ist') {
        appendAirportTransfer(outbound, 'ist', 'saw');
        if(inbound?.segments[0]) inbound.segments[0]=withDeparturePlace(inbound.segments[0],'saw');
      }
      if(inbound&&Date.parse(inbound.segments[0]!.departureAt)<=Date.parse(outbound.segments.at(-1)!.arrivalAt)) continue;
      const materialTerms=flightProfile(query.originCityId,query.destinationCityId)?['حفاظت اتصال و انتقال بار بین شرکت‌ها اعلام نشده است.','میزان بار این ترکیب اعلام نشده است.','شرایط هر بخش مسیر را پیش از ادامه بررسی کنید.']:query.mode==='train'?['نوع کوپه یا صندلی مطابق کلاس انتخاب‌شده است.','جزئیات پذیرایی و جریمه لغو اعلام نشده است.']:query.mode==='bus'?['نوع صندلی مطابق کلاس انتخاب‌شده است.','میزان بار و جریمه لغو اعلام نشده است.']:[];
      const payload=rawShape(p,{materialTerms,serviceKey,outbound,inbound:input.caseId==='incomplete-round-trip'?undefined:inbound,originAlias:scenario==='conflicting-data'&&p===4&&variant===0?origin.name+' مرکزی':p===2?'  '+origin.name.replace(/ی/g,'ي').replace(/ک/g,'ك')+'  ':origin.name,destinationAlias:p===3&&destination.id==='istanbul'?'Istanbul / استانبول':destination.name,classCode:query.classCode,value:amountRial/divisor,unit,mandatoryFees:incomplete?null:120000*(query.party.adults+query.party.children)/divisor,baggageKg:p===2||query.mode!=='flight'||flightProfile(query.originCityId,query.destinationCityId)?null:p===4?30:20,refundable:p===3?null:p===4||variant===1,available:!(scenario==='sold-out'&&input.phase==='recheck'&&p===4&&variant===0||p===6&&variant===2),seats:variant===2?1:9,party:{adults:query.party.adults,children:query.party.children,infants:query.party.infants},revision:{fixtureVersion:input.fixtureVersion,mappingRevision:input.mappingRevision,sourceRevision:fixtureSourceRevision(input.fixtureVersion)}});
      records.push({rawRecordId:`raw-${digest([input,provider.providerId,variant]).slice(0,32)}`,providerId:provider.providerId,sourceNamespace:`${provider.providerId}/v1`,observedAt:new Date(anchor).toISOString(),fixtureVersion:input.fixtureVersion,payload:JSON.parse(JSON.stringify(payload))});
    }
  }
  if(input.caseId==='duplicate'&&records[0]) records.push({...records[0],rawRecordId:records[0].rawRecordId+'-duplicate',payload:structuredClone(records[0].payload)});
  return records;
}
