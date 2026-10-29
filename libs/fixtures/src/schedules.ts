import {createHash} from 'node:crypto';
import type {JourneyLeg,Segment} from '@torob-ticket/contracts';
import {places} from './catalog/places';
import {atLocalHour} from './calendar';
import {distanceKm,groundSegmentMinutes,transportPlace,type Connection} from './catalog/connections';
import {flightProfile} from './catalog/flight-profiles';
const after=(instant:string,minutes:number)=>new Date(Date.parse(instant)+minutes*60000).toISOString();
const placeById=new Map(places.map(place=>[place.id,place]));
const speedFactors=[.96,1,1.04,1.02,1.06,.98,1.08,1.1,.94,1.03,1.07,1] as const;
const round5=(minutes:number)=>Math.round(minutes/5)*5;
export const servicesPerRoute=12;

/** Immutable dated schedule identity, shared by sellers and query roles. */
function identifySegment(fields:Omit<Segment,'segmentId'>):Segment {
 const digest=createHash('sha256').update(JSON.stringify([fields.serviceId,fields.mode,fields.operatorId,fields.originPlaceId,fields.destinationPlaceId,fields.departureAt,fields.arrivalAt,fields.departureTimeZone,fields.arrivalTimeZone])).digest('hex');
 return{...fields,segmentId:`demo-segment-${digest}`};
}
export function withDeparturePlace(segment:Segment,placeId:string):Segment {
 const place=placeById.get(placeId);if(!place)throw new RangeError('Unknown departure place');
 return identifySegment({...segment,serviceId:`${segment.serviceId}-from-${placeId}`,originPlaceId:placeId,departureTimeZone:place.timeZone});
}
function departure(date:string,variant:number,isReturn:boolean,zone:string,classCode?:string):string {
 const minutes=isReturn?1080+variant*30:variant*120;
 const classOffset=classCode==='seat'?0:classCode==='sleeper-6'?10:classCode==='sleeper-4'?5:0;
 return after(atLocalHour(date,Math.floor(minutes/60),zone),minutes%60+classOffset);
}
const railOperators=['rail:raja','rail:fadak','rail:bonrail','rail:noor-alreza','rail:raja','rail:rail-tarabar-saba','rail:bonrail','rail:rail-seir-kowsar','rail:fadak','rail:raja','rail:bonrail','rail:noor-alreza'];
const busOperators=['bus:iran-peyma','bus:hamsafar','bus:royal-safar','bus:seir-o-safar','bus:tarabar-bita','bus:arya-safar','bus:levan-noor','bus:giti-peyma','bus:mihan-noor','bus:eiman-safar','bus:peyk-motamed','bus:adl'];
function railOperator(variant:number,classCode:string|undefined):string {
 return classCode==='seat'?'rail:raja':classCode==='sleeper-6'?['rail:joopar','rail:mahtab-seir-jam','rail:pars-larim'][variant%3]!:railOperators[variant]!;
}
function airOperator(from:string,to:string,family:number,domestic:boolean):string {
 if(domestic)return `demo-operator-flight-${family}`;
 const pair=[from,to];
 if(pair.includes('istanbul'))return 'airline:turkish-airlines';
 if(pair.includes('doha'))return 'airline:qatar-airways';
 if(pair.includes('dubai'))return 'airline:emirates';
 if(pair.includes('singapore'))return 'airline:singapore-airlines';
 if(pair.includes('sydney')||pair.includes('auckland'))return 'airline:qantas';
 if(pair.includes('tokyo'))return 'airline:ana';
 if(pair.includes('tehran')||pair.includes('mashhad')||pair.includes('shiraz')||pair.includes('tabriz'))return family===1?'demo-operator-flight-0':'demo-operator-flight-1';
 if(pair.includes('frankfurt'))return 'airline:lufthansa';
 if(pair.includes('london'))return 'airline:british-airways';
 return 'airline:air-france';
}
function segment(mode:Segment['mode'],serviceId:string,operatorId:string,fromId:string,toId:string,departureAt:string,minutes:number):Segment {
 const from=placeById.get(fromId)!,to=placeById.get(toId)!;
 return identifySegment({mode,serviceId,operatorId,originPlaceId:from.id,destinationPlaceId:to.id,departureAt,arrivalAt:after(departureAt,minutes),departureTimeZone:from.timeZone,arrivalTimeZone:to.timeZone});
}
function append(leg:JourneyLeg,next:Segment,wait:number,kind:JourneyLeg['stops'][number]['kind'],vehicleChange:boolean):void {
 const previous=leg.segments.at(-1);
 if(previous)leg.stops.push({placeId:next.originPlaceId,kind,waitMinutes:wait,vehicleChange,arrivalAt:previous.arrivalAt,departureAt:next.departureAt});
 leg.segments.push(next);
}
/** Authored source services, not published carrier timetables or protected connections. */
export function journey(connection:Connection,date:string,variant:number,isReturn=false,classCode?:string):JourneyLeg {
 if(!Number.isInteger(variant)||variant<0||variant>=servicesPerRoute)throw new RangeError('Unknown service slot');
 const {mode,scope,originCityId,destinationCityId}=connection;
 const a=transportPlace(originCityId,mode,scope);
 const start=departure(date,variant,isReturn,a.timeZone,classCode),family=variant%3;
 const serviceId=`demo-v3-${mode}-${originCityId}-${destinationCityId}-${variant}-${start}${mode==='flight'?'':`-${classCode}`}`;
 const leg:JourneyLeg={segments:[],stops:[]};
 const pattern=mode==='flight'?flightProfile(originCityId,destinationCityId)?.patterns[family]:undefined;
 if(pattern){
  const reversed=destinationCityId==='tehran',airports=reversed?[...pattern.airports].reverse():pattern.airports,operators=reversed?[...pattern.operators].reverse():pattern.operators;
  const waits=reversed?[...pattern.waits].reverse():pattern.waits,minutes=reversed?pattern.returnMinutes:pattern.minutes;
  let nextAt=start;
  for(let index=0;index<minutes.length;index++){
   const wait=index?waits[index-1]!+(Math.floor(variant/3)*10):0;
   if(index)nextAt=after(leg.segments.at(-1)!.arrivalAt,wait);
   append(leg,segment('flight',`${serviceId}-${index}`,operators[index]!,airports[index]!,airports[index+1]!,nextAt,minutes[index]!),wait,'connection',true);
  }
  return leg;
 }
 if(mode==='flight'){
  const forcedHub=scope==='international'&&[originCityId,destinationCityId].includes('van')?'istanbul':undefined;
  const via=forcedHub??(family>0?connection.alternativeCityIds?.[(family-1)%connection.alternativeCityIds.length]:undefined);
  const route=via&&via!==originCityId&&via!==destinationCityId?[originCityId,via,destinationCityId]:[originCityId,destinationCityId];
  for(let index=0;index<route.length-1;index++){
   const from=transportPlace(route[index]!,mode,scope),to=transportPlace(route[index+1]!,mode,scope);
   const minutes=round5(Math.max(45,35+distanceKm(route[index]!,route[index+1]!)/12)*(1+(variant%4-1)*.02));
   const wait=index?(scope==='international'?120:family===1?50:120)+Math.floor(variant/3)*10:0;
   const nextAt=index?after(leg.segments.at(-1)!.arrivalAt,wait):start;
   const changes=family===2||scope==='international';
   const operator=airOperator(route[index]!,route[index+1]!,family,scope==='domestic');
   append(leg,segment(mode,changes?`${serviceId}-${index}`:serviceId,operator,from.id,to.id,nextAt,minutes),wait,changes?'connection':'technical-stop',changes);
  }
  return leg;
 }
 const route=connection.routeCityIds??[originCityId,destinationCityId];
 const heroTrain=mode==='train'&&[originCityId,destinationCityId].sort().join(':')==='mashhad:tehran';
 for(let index=0;index<route.length-1;index++){
  const fromCity=route[index]!,toCity=route[index+1]!;
  const connector=mode==='train'&&[fromCity,toCity].sort().join(':')==='tatvan:van';
  const beforeConnector=mode==='train'&&index>0&&[route[index-1],fromCity].sort().join(':')==='tatvan:van';
  const stageMode=connector?'bus':mode;
  const from=transportPlace(fromCity,mode,scope),to=transportPlace(toCity,mode,scope);
  const turkishRail=mode==='train'&&!connector&&['tatvan','ankara','istanbul'].includes(fromCity)&&['tatvan','ankara','istanbul'].includes(toCity);
  const turkishBus=mode==='bus'&&['van','ankara','istanbul'].includes(fromCity)&&['van','ankara','istanbul'].includes(toCity);
  const operator=connector?'ground-transfer:van-tatvan':turkishRail?'rail:tcdd':mode==='train'?railOperator(variant,classCode):turkishBus?(variant%2?'bus:kamil-koc':'bus:metro-turizm'):busOperators[variant]!;
  const previous=leg.segments.at(-1),changed=Boolean(previous&&(connector||beforeConnector||previous.operatorId!==operator||fromCity==='tehran'||fromCity==='ankara'));
  const wait=previous?(connector?120:beforeConnector?150:fromCity==='tabriz'?30:changed?90:25):0;
  const nextAt=previous?after(previous.arrivalAt,wait):start;
  let minutes=round5(groundSegmentMinutes(fromCity,toCity,stageMode)*speedFactors[variant]!);
  if(heroTrain)minutes=(classCode==='seat'?[525,635,660,550,615,690,575,650,705,600,670,720]:classCode==='sleeper-6'?[660,675,690,650,680,705,665,695,720,670,700,735]:[660,635,615,645,675,690,620,650,680,630,665,710])[variant]!;
  append(leg,segment(stageMode,changed||connector||turkishRail?`${serviceId}-${index}`:previous?.serviceId??serviceId,operator,from.id,to.id,nextAt,minutes),wait,connector||beforeConnector?'ground-transfer':changed?'connection':'dwell',changed);
 }
 return leg;
}

/** Explicit airport change remains an ancillary source-owned ground service. */
export function appendAirportTransfer(leg:JourneyLeg,fromId:string,toId:string):void {
 const arrivalAt=leg.segments.at(-1)!.arrivalAt,departureAt=after(arrivalAt,30);
 leg.stops.push({placeId:fromId,kind:'ground-transfer',waitMinutes:30,vehicleChange:true,arrivalAt,departureAt});
 leg.segments.push(segment('bus',`demo-transfer-${fromId}-${toId}-${departureAt}`,'demo-transfer-operator',fromId,toId,departureAt,75));
}
