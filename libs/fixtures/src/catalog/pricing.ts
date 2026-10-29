import type { TransportSearchQuery } from '@torob-ticket/contracts';
import { flightProfile } from './flight-profiles';

/** Adult whole-journey gross mock inputs in integer rials, never FX conversion.
 * Primary one-traveler card snapshots (including separately labelled sold-out metadata)
 * calibrate the ground bands; distant air bands are authored inferences, not observed fares.
 * Provenance/date/currency and those limits are recorded in fixture-research.md.
 */
export function adultFareRial(query:TransportSearchQuery,variant:number):number {
  if(query.mode==='flight'){
    const profile=flightProfile(query.originCityId,query.destinationCityId);
    const base=profile?profile.baseFareRial*[100,94,88][variant]!/100:(query.scope==='domestic'?18000000:100000000)*[100,108,92][variant]!/100;
    return base*(query.classCode==='business'?2.4:1);
  }
  if(query.mode==='train'){
    if(query.scope==='international')return query.classCode==='seat'?32000000:query.classCode==='sleeper-6'?42000000:58000000;
    if(query.classCode==='seat')return[9150500,18250000,9150500][variant]!;
    if(query.classCode==='sleeper-6')return[11200000,12238000,11200000][variant]!;
    return[20029500,35900000,15569500][variant]!;
  }
  if(query.scope==='international')return(query.classCode==='vip'?46000000:35000000)*[1,.96,1.04][variant]!;
  return(query.classCode==='vip'?[6450000,6470000,7120000]:[5370000,5600000,5900000])[variant]!;
}
