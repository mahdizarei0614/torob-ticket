import type {TransportSearchQuery} from '@torob-ticket/contracts';
import {connections,distanceKm} from './connections';
import {flightProfile} from './flight-profiles';

/** Authored gross-rial bands: 0049 dated cards calibrate representative ground classes.
 * Distance/route/service factors extend those bands; they are not live availability,
 * a conversion from foreign currency or a sum of independent one-way quotations.
 */
export function adultFareRial(query:TransportSearchQuery,variant:number):number {
 const connection=connections.find(c=>c.mode===query.mode&&c.originCityId===query.originCityId&&c.destinationCityId===query.destinationCityId)!;
 const km=connection.distanceKm,family=variant%3,departureFactor=1+Math.floor(variant/3)*.025;
 if(query.mode==='flight'){
  const profile=flightProfile(query.originCityId,query.destinationCityId);
  const base=profile?profile.baseFareRial*[1,.94,.88][family]!:query.scope==='domestic'?(11000000+km*10500)*[1,.94,.9][family]!:(100000000+km*65000)*[1,.95,.89][family]!;
  return Math.round(base*departureFactor*(query.classCode==='business'?2.4:1)/1000)*1000;
 }
 if(query.mode==='train'){
  const reference=distanceKm('tehran','mashhad'),routeFactor=Math.max(.4,.15+.85*km/reference);
  const base=query.scope==='international'?(query.classCode==='seat'?32000000:query.classCode==='sleeper-6'?42000000:58000000)*Math.max(.4,km/distanceKm('tehran','van')):
   query.classCode==='seat'?[9150500,18250000,11800000][family]!*routeFactor:
   query.classCode==='sleeper-6'?[11200000,12238000,13100000][family]!*routeFactor:
   [20029500,35900000,15569500][family]!*routeFactor;
  return Math.round(base*departureFactor/1000)*1000;
 }
 const reference=distanceKm('tehran','isfahan'),routeFactor=Math.max(.35,.2+.8*km/reference);
 const base=(query.classCode==='vip'?[6450000,6470000,7120000]:[5370000,5600000,5900000])[family]!;
 // Border processing and a supplied through-route cost remain inside this source gross.
 const borderFactor=query.scope==='international'?1.15:1;
 return Math.round(base*routeFactor*departureFactor*borderFactor/1000)*1000;
}
