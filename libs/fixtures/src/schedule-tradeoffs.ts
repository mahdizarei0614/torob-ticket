import type {JourneyLeg} from '@torob-ticket/contracts';
import type {Connection} from './catalog/connections';
import {identifySegment} from './schedules';

/** Authored hub departures, not operating timetables or connection guarantees.
 * A shorter route can wait longer for its onward flight. No path/stop is added.
 */
const oneStopWaits:Readonly<Record<string,number>>={london:540,paris:540,'new-york':300};
export function withScheduleTradeoffs(leg:JourneyLeg,connection:Connection,variant:number):JourneyLeg {
 const city=connection.originCityId==='tehran'?connection.destinationCityId:connection.destinationCityId==='tehran'?connection.originCityId:undefined;
 const longWait=city?oneStopWaits[city]:undefined;
 if(connection.mode!=='flight'||connection.scope!=='international'||longWait===undefined||leg.segments.length<2)return leg;
 const result=structuredClone(leg),slot=Math.floor(variant/3);
 for(let index=1;index<result.segments.length;index++){
  const previous=result.segments[index-1]!,original=leg.segments[index]!,stop=result.stops[index-1];
  if(!stop||stop.placeId!==original.originPlaceId||previous.destinationPlaceId!==original.originPlaceId)throw new RangeError('Invalid supplied connection boundary');
  const wait=result.segments.length===2?longWait+slot*25:90+slot*5;
  const departureAt=new Date(Date.parse(previous.arrivalAt)+wait*60000).toISOString();
  const arrivalAt=new Date(Date.parse(departureAt)+Date.parse(original.arrivalAt)-Date.parse(original.departureAt)).toISOString();
  result.segments[index]=identifySegment({...original,serviceId:`${original.serviceId}-connection-${departureAt}`,departureAt,arrivalAt});
  result.stops[index-1]={...stop,waitMinutes:wait,arrivalAt:previous.arrivalAt,departureAt};
 }
 return result;
}
