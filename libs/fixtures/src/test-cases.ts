import type { RawProviderRecord, RoomRate } from '@torob-ticket/contracts';
import { materializeRoomRates } from './catalog/hotels';
import { toGregorianDate } from '@torob-ticket/domain';
import { fixtureIdentity } from './identity';
import { generateProviderRecords, type FixtureQuery } from './generator';
export interface FixtureCase {
  id:string; focus:1|2|3|4|5; ownerTasks:string[]; description:string;
  inputs:FixtureQuery[]; records:RawProviderRecord[][];
  events:{atMs:number;kind:string;generation:string;sourceId:string}[];
  environment?:{contextLost?:boolean;reducedMotion?:boolean;width?:number;modalOpen?:boolean;selectedService:string;scrollTop:number};
  hotelRates?:RoomRate[];
  hotelRequest?:{destinationCityId:string;adults:number;children:number;rooms:number;maxAdultsPerRoom:number};
  referralContext?:{reviewerIds:string[];resourceId:string;idempotencyKey:string;acceptedVersion:number;currentVersion:number};
}
export const fixtureCaseIds=['local-midnight','jalali-boundary','overnight','same-day-return','late-query','reconnect-frozen','mixed-units','missing-fees','airport-change','different-class','missing-baggage','incomplete-round-trip','hotel-occupancy','reviewer-isolation','repeated-click','stale-intent','context-loss','reduced-motion','small-screen','modal-canvas'] as const;
export function fixtureCase(id:string):FixtureCase {
  const index=(fixtureCaseIds as readonly string[]).indexOf(id);if(index<0)throw new RangeError('Unknown fixture case');
  const focus=index<4?1:index<6?2:index<13?3:index<16?4:5;
  const input:FixtureQuery={...fixtureIdentity,seed:73,anchorInstant:'2026-10-24T00:00:00.000Z',scenario:'normal',scenarioRevision:'scenario-v1',mappingRevision:'mapping-v1',query:{mode:'flight',scope:'domestic',originCityId:'tehran',destinationCityId:'mashhad',tripType:'round-trip',departureDate:'2026-10-24',returnDate:'2026-10-27',party:{adults:2,children:1,infants:0,childAges:[8]},classCode:'economy',filters:{},sort:'cheapest'}};
  if(id==='local-midnight') {input.anchorInstant='2026-10-23T21:00:00.000Z';}
  if(id==='jalali-boundary') {input.anchorInstant='2025-03-19T21:00:00.000Z';input.query.departureDate=toGregorianDate('1403-12-30','persian');input.query.returnDate=toGregorianDate('1404-01-01','persian');}
  if(id==='same-day-return') input.query.returnDate=input.query.departureDate;
  if(id==='airport-change') {input.caseId='airport-change';input.query.scope='international';input.query.destinationCityId='istanbul';}
  if(id==='incomplete-round-trip') input.caseId='incomplete-round-trip';
  if(id==='missing-fees') input.scenario='conflicting-data';
  if(id==='late-query'||id==='reconnect-frozen') input.scenario='slow-provider';
  const inputs=[input];
  if(id==='different-class') inputs.push({...input,query:{...input.query,classCode:'business'}});
  if(id==='late-query') inputs.push({...input,query:{...input.query,departureDate:'2026-10-25'}});
  if(id==='reviewer-isolation') inputs.push({...input,seed:74,scenario:'sold-out'});
  const events=focus===2?[{atMs:150,kind:'snapshot',generation:'generation-a',sourceId:'demo-provider-01'},{atMs:500,kind:id==='late-query'?'query-change':'freeze-selection',generation:id==='late-query'?'generation-b':'generation-a',sourceId:'consumer'},{atMs:2400,kind:'late-snapshot',generation:'generation-a',sourceId:'demo-provider-04'},{atMs:2600,kind:'reconnect-duplicate',generation:'generation-a',sourceId:'demo-provider-04'}]:[];
  if(id==='repeated-click') events.push({atMs:100,kind:'confirm',generation:'intent-a',sourceId:'click-a-1'},{atMs:101,kind:'confirm',generation:'intent-a',sourceId:'click-a-1'});
  const owners={1:['T03','T07','T16','T20'],2:['T09','T15','T17','T28'],3:['T03','T06','T07','T08','T10','T20'],4:['T04','T11','T22','T23','T26','T30'],5:['T12','T13','T14','T18','T21','T27','T31','T32']};
  return {id,focus,ownerTasks:owners[focus],description:`Deterministic input for ${id}; runtime acceptance belongs to ownerTasks.`,inputs,records:inputs.map(generateProviderRecords),events,...focus===5?{environment:{contextLost:id==='context-loss',reducedMotion:id==='reduced-motion',width:id==='small-screen'?390:1280,modalOpen:id==='modal-canvas',selectedService:'flight:tehran:mashhad:2026-10-24:2026-10-27:0',scrollTop:420}}:{},...id==='hotel-occupancy'?{hotelRates:materializeRoomRates(input.anchorInstant,'mashhad'),hotelRequest:{destinationCityId:'mashhad',adults:2,children:1,rooms:1,maxAdultsPerRoom:1}}:{},...focus===4?{referralContext:{reviewerIds:['reviewer-a','reviewer-b'],resourceId:'quote-a-1',idempotencyKey:'click-a-1',acceptedVersion:1,currentVersion:id==='stale-intent'?2:1}}:{}};
}
