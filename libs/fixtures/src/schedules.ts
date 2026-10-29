import { createHash } from 'node:crypto';
import type { JourneyLeg, Segment } from '@torob-ticket/contracts';
import { places } from './catalog/places';
import { atLocalHour } from './calendar';
import { transportPlace, type Connection } from './catalog/connections';
import { flightProfile } from './catalog/flight-profiles';
const after = (instant:string,minutes:number)=>new Date(Date.parse(instant)+minutes*60000).toISOString();
/** A segment identity describes its immutable schedule facts, independently of seller/query role. */
function identifySegment(fields: Omit<Segment, 'segmentId'>): Segment {
  const identity = [fields.serviceId, fields.mode, fields.operatorId, fields.originPlaceId,
    fields.destinationPlaceId, fields.departureAt, fields.arrivalAt,
    fields.departureTimeZone, fields.arrivalTimeZone];
  const digest = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return { ...fields, segmentId: `demo-segment-${digest}` };
}

/** Airport changes are different source services, not an in-place identity rewrite. */
export function withDeparturePlace(segment: Segment, placeId: string): Segment {
  const place = places.find(candidate => candidate.id === placeId);
  if (!place) throw new RangeError('Unknown departure place');
  return identifySegment({ ...segment, serviceId: `${segment.serviceId}-from-${placeId}`,
    originPlaceId: placeId, departureTimeZone: place.timeZone });
}

/** Shared service IDs deliberately survive different seller payloads. All schedules are fiction. */
export function journey(connection:Connection,date:string,variant:number,isReturn=false,classCode?:string):JourneyLeg {
  const {mode,scope,originCityId,destinationCityId}=connection;
  const a=transportPlace(originCityId,mode,scope), b=transportPlace(destinationCityId,mode,scope);
  const pattern=mode==='flight'?flightProfile(originCityId,destinationCityId)?.patterns[variant]:undefined;
  if(pattern){
    const reversed=destinationCityId==='tehran';
    const airports=reversed?[...pattern.airports].reverse():pattern.airports;
    const operators=reversed?[...pattern.operators].reverse():pattern.operators;
    const waits=reversed?[...pattern.waits].reverse():pattern.waits;
    const minutes=reversed?pattern.returnMinutes:pattern.minutes;
    const start=atLocalHour(date,(isReturn?[19,21,23]:[7,13,19])[variant]!,a.timeZone);
    const segments:Segment[]=[],stops:JourneyLeg['stops']=[];
    let departureAt=start;
    for(let index=0;index<minutes.length;index++){
      const from=places.find(p=>p.id===airports[index])!,to=places.find(p=>p.id===airports[index+1])!;
      const arrivalAt=after(departureAt,minutes[index]!);
      segments.push(identifySegment({mode:'flight',serviceId:`demo-flight-${originCityId}-${destinationCityId}-${variant}-${index}-${departureAt}`,operatorId:operators[index]!,originPlaceId:from.id,destinationPlaceId:to.id,departureAt,arrivalAt,departureTimeZone:from.timeZone,arrivalTimeZone:to.timeZone}));
      if(index<waits.length){const next=after(arrivalAt,waits[index]!);stops.push({placeId:to.id,kind:'connection',vehicleChange:true,waitMinutes:waits[index]!,arrivalAt,departureAt:next});departureAt=next;}
    }
    return{segments,stops};
  }
  const start=atLocalHour(date,isReturn?[19,21,23][variant]!: [7,13,22][variant]!,a.timeZone);
  const serviceId=`demo-${mode}-${originCityId}-${destinationCityId}-${variant}-${start}${mode==='train'?`-${classCode==='seat'?'saloon':classCode==='sleeper-6'?'six-berth':'four-berth'}`:''}`;
  const overnightConnection=mode==='flight'&&variant===2&&originCityId!=='tabriz'&&destinationCityId!=='tabriz';
  const heroTrain=mode==='train'&&[originCityId,destinationCityId].includes('tehran')&&[originCityId,destinationCityId].includes('mashhad');
  const heroBus=mode==='bus'&&[originCityId,destinationCityId].includes('tehran')&&[originCityId,destinationCityId].includes('isfahan');
  const duration=heroTrain?(classCode==='seat'?[525,635,740]:classCode==='sleeper-6'?[660,675,690]:[660,635,615])[variant]!:heroBus?[330,345,330][variant]!:connection.durationMinutes+(overnightConnection?300:variant===1?120:variant===2?30:0);
  const operatorId=mode==='train'?(scope==='international'||classCode==='seat'?'rail:raja':classCode==='sleeper-6'?['rail:joopar','rail:mahtab-seir-jam','rail:joopar'][variant]!:['rail:raja','rail:fadak','rail:bonrail'][variant]!):mode==='bus'?['bus:iran-peyma','bus:hamsafar','bus:royal-safar'][variant]!:`demo-operator-${mode}-${variant}`;
  const segment=(from:typeof a,to:typeof a,departureAt:string,arrivalAt:string,identity=serviceId):Segment=>identifySegment({mode,serviceId:identity,operatorId,originPlaceId:from.id,destinationPlaceId:to.id,departureAt,arrivalAt,departureTimeZone:from.timeZone,arrivalTimeZone:to.timeZone});
  const via = connection.viaCityId ?? (mode==='flight'&&variant>0&&originCityId!=='tabriz'&&destinationCityId!=='tabriz'?'tabriz':undefined);
  if (!via || via===originCityId || via===destinationCityId) return {segments:[segment(a,b,start,after(start,duration))],stops:[]};
  const stop=transportPlace(via,mode,scope); const wait=overnightConnection?180:mode==='flight'?45:90; const first=overnightConnection?90:Math.floor((duration-wait)*.55);
  const arrival=after(start,first),departure=after(arrival,wait);
  const onward=segment(stop,b,departure,after(start,duration),overnightConnection?`${serviceId}-connection`:serviceId);
  return {segments:[segment(a,stop,start,arrival),onward],stops:[{placeId:stop.id,kind:overnightConnection?'connection':mode==='flight'?'technical-stop':'dwell',waitMinutes:wait,vehicleChange:overnightConnection,arrivalAt:arrival,departureAt:departure}]};
}

/** Authored airport-transfer evidence is a ground segment, never hidden inside a flight. */
export function appendAirportTransfer(leg:JourneyLeg,fromId:string,toId:string):void {
  const from=places.find(p=>p.id===fromId)!,to=places.find(p=>p.id===toId)!;
  const arrivalAt=leg.segments.at(-1)!.arrivalAt,departureAt=after(arrivalAt,30);
  leg.stops.push({placeId:fromId,kind:'ground-transfer',waitMinutes:30,vehicleChange:true,arrivalAt,departureAt});
  leg.segments.push(identifySegment({mode:'bus',serviceId:`demo-transfer-${fromId}-${toId}-${departureAt}`,operatorId:'demo-transfer-operator',originPlaceId:fromId,destinationPlaceId:toId,departureAt,arrivalAt:after(departureAt,75),departureTimeZone:from.timeZone,arrivalTimeZone:to.timeZone}));
}
