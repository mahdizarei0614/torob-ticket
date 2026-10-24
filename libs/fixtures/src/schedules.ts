import type { JourneyLeg, Segment } from '@torob-ticket/contracts';
import { places } from './catalog/places';
import { atLocalHour } from './calendar';
import { transportPlace, type Connection } from './catalog/connections';
const after = (instant:string,minutes:number)=>new Date(Date.parse(instant)+minutes*60000).toISOString();
/** Shared service IDs deliberately survive different seller payloads. All schedules are fiction. */
export function journey(connection:Connection,date:string,variant:number,isReturn=false):JourneyLeg {
  const {mode,scope,originCityId,destinationCityId}=connection;
  const a=transportPlace(originCityId,mode,scope), b=transportPlace(destinationCityId,mode,scope);
  const serviceId=`demo-${mode}-${originCityId}-${destinationCityId}-${variant}`;
  const start=atLocalHour(date,isReturn?[19,21,23][variant]!: [7,13,22][variant]!,a.timeZone);
  const overnightConnection=mode==='flight'&&variant===2&&originCityId!=='tabriz'&&destinationCityId!=='tabriz';
  const duration=connection.durationMinutes+(overnightConnection?300:variant===1?120:variant===2?30:0);
  const segment=(suffix:string,from:typeof a,to:typeof a,departureAt:string,arrivalAt:string):Segment=>({segmentId:`${serviceId}-${date}-${suffix}`,mode,serviceId,operatorId:`demo-operator-${mode}-${variant}`,originPlaceId:from.id,destinationPlaceId:to.id,departureAt,arrivalAt,departureTimeZone:from.timeZone,arrivalTimeZone:to.timeZone});
  const via = connection.viaCityId ?? (mode==='flight'&&variant>0&&originCityId!=='tabriz'&&destinationCityId!=='tabriz'?'tabriz':undefined);
  if (!via || via===originCityId || via===destinationCityId) return {segments:[segment('direct',a,b,start,after(start,duration))],stops:[]};
  const stop=transportPlace(via,mode,scope); const wait=overnightConnection?180:mode==='flight'?45:90; const first=overnightConnection?90:Math.floor((duration-wait)*.55);
  const arrival=after(start,first),departure=after(arrival,wait);
  const onward=segment('b',stop,b,departure,after(start,duration));
  if(overnightConnection) onward.serviceId+='-connection';
  return {segments:[segment('a',a,stop,start,arrival),onward],stops:[{placeId:stop.id,kind:overnightConnection?'connection':mode==='flight'?'technical-stop':'dwell',waitMinutes:wait,vehicleChange:overnightConnection,arrivalAt:arrival,departureAt:departure}]};
}

/** Authored airport-transfer evidence is a ground segment, never hidden inside a flight. */
export function appendAirportTransfer(leg:JourneyLeg,fromId:string,toId:string):void {
  const from=places.find(p=>p.id===fromId)!,to=places.find(p=>p.id===toId)!;
  const arrivalAt=leg.segments.at(-1)!.arrivalAt,departureAt=after(arrivalAt,30);
  leg.stops.push({placeId:fromId,kind:'ground-transfer',waitMinutes:30,vehicleChange:true,arrivalAt,departureAt});
  leg.segments.push({segmentId:'demo-ground-'+fromId+'-'+toId,mode:'bus',serviceId:'demo-transfer-'+fromId+'-'+toId,operatorId:'demo-transfer-operator',originPlaceId:fromId,destinationPlaceId:toId,departureAt,arrivalAt:after(departureAt,75),departureTimeZone:from.timeZone,arrivalTimeZone:to.timeZone});
}
