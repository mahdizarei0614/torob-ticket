import type { Mode, SupportedConnection } from '@torob-ticket/contracts';
import { cities } from './cities';
import { places } from './places';
import { flightProfile } from './flight-profiles';

export interface Connection extends SupportedConnection {
  durationMinutes: number;
  distanceKm: number;
  /** Supplied route, including connections; never an inferred traveler recombination. */
  routeCityIds?: readonly string[];
  alternativeCityIds?: readonly string[];
  geometry: {type:'LineString';coordinates:number[][]};
}
const byCity=new Map(cities.map(city=>[city.id,city]));
export function distanceKm(originCityId:string,destinationCityId:string):number {
  const a=byCity.get(originCityId)!.point,b=byCity.get(destinationCityId)!.point;
  const rad=Math.PI/180,dlat=(b.latitude-a.latitude)*rad,dlon=(b.longitude-a.longitude)*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dlon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function transportPlace(cityId:string,mode:Mode,scope:string) {
  const kind=mode==='flight'?'airport':mode==='train'?'station':'terminal';
  const place=places.find(p=>p.cityId===cityId&&p.kind===kind&&(cityId!=='tehran'||mode!=='flight'||p.id===(scope==='international'?'ika':'thr')));
  if(!place)throw new RangeError('Unknown transport place');
  return place;
}
const connections:Connection[]=[];
const round5=(value:number)=>Math.round(value/5)*5;
const railMinutes:Record<string,number>={
  'tabriz:tehran':690,'tabriz:van':630,'tatvan:van':150,
  'ankara:tatvan':1560,'ankara:istanbul':330,
};
export function groundSegmentMinutes(a:string,b:string,mode:'train'|'bus'):number {
  const key=[a,b].sort().join(':');
  if(mode==='train'&&railMinutes[key])return railMinutes[key];
  if(key==='tatvan:van')return 150;
  if(mode==='train'&&key==='mashhad:tehran')return 660;
  if(mode==='bus'&&key==='isfahan:tehran')return 330;
  const international=byCity.get(a)!.countryCode!==byCity.get(b)!.countryCode;
  return round5(Math.max(mode==='train'?100:75,distanceKm(a,b)*(mode==='train'?1.25:1.3)/(mode==='train'?1.15:1.1)+(international?180:30)));
}
function addPair(mode:Mode,a:string,b:string,routeCityIds?:readonly string[],alternativeCityIds?:readonly string[]):void {
  const scope=byCity.get(a)!.countryCode==='IR'&&byCity.get(b)!.countryCode==='IR'?'domestic':'international';
  if(connections.some(c=>c.mode===mode&&c.originCityId===a&&c.destinationCityId===b))return;
  const route=routeCityIds??[a,b],km=route.slice(1).reduce((sum,id,index)=>sum+distanceKm(route[index]!,id),0);
  const pattern=mode==='flight'?flightProfile(a,b)?.patterns[0]:undefined;
  const minutes=pattern?[...pattern.minutes,...pattern.waits].reduce((s,n)=>s+n,0):mode==='flight'?round5(35+km/12):route.slice(1).reduce((sum,id,index)=>sum+groundSegmentMinutes(route[index]!,id,mode==='train'&&[route[index],id].sort().join(':')==='tatvan:van'?'bus':mode),0)+(route.length-2)*90;
  for(const reverse of [false,true]){
    const from=reverse?b:a,to=reverse?a:b,ordered=reverse?[...route].reverse():route;
    const coordinates=pattern?(reverse?[...pattern.airports].reverse():pattern.airports).map(id=>{const p=places.find(p=>p.id===id)!.point;return[p.longitude,p.latitude];}):ordered.map(id=>{const p=transportPlace(id,mode,scope).point;return[p.longitude,p.latitude];});
    const durationMinutes=pattern&&reverse?[...pattern.returnMinutes,...pattern.waits].reduce((s,n)=>s+n,0):minutes;
    connections.push({mode,scope,originCityId:from,destinationCityId:to,distanceKm:km,durationMinutes,geometry:{type:'LineString',coordinates},...(routeCityIds?{routeCityIds:ordered}:{}),...(alternativeCityIds?{alternativeCityIds}: {})});
  }
}

// Keep all existing Tehran spokes. Twelve dated services are authored per supported route/class;
// a selectable route describes source-supplied fixture inventory, not a live direct-service claim.
for(const destination of cities.filter(city=>city.id!=='tehran'&&city.id!=='tatvan')){
  addPair('flight','tehran',destination.id,undefined,destination.countryCode==='IR'?[destination.id==='isfahan'?'mashhad':'isfahan']:['istanbul','dubai'].filter(id=>id!==destination.id));
  if(destination.countryCode==='IR')for(const mode of ['train','bus'] as const)addPair(mode,'tehran',destination.id);
}

// Curated large-city domestic network; rail spokes use explicit Tehran connections where supplied.
const domesticPairs:[string,string][]=[
 ['mashhad','isfahan'],['mashhad','shiraz'],['mashhad','tabriz'],['mashhad','rasht'],['mashhad','yazd'],['mashhad','ahvaz'],['mashhad','bandar-abbas'],['mashhad','kerman'],['mashhad','hamadan'],['mashhad','kermanshah'],
 ['isfahan','shiraz'],['isfahan','yazd'],['isfahan','ahvaz'],['isfahan','bandar-abbas'],['isfahan','kerman'],['isfahan','tabriz'],['isfahan','rasht'],
 ['shiraz','bandar-abbas'],['shiraz','kerman'],['shiraz','ahvaz'],['shiraz','tabriz'],['yazd','kerman'],['yazd','bandar-abbas'],['kerman','bandar-abbas'],['tabriz','rasht'],['ahvaz','kermanshah'],
];
for(const [a,b]of domesticPairs){
 addPair('flight',a,b,undefined,['tehran']);addPair('bus',a,b);
 addPair('train',a,b,[a,'tehran',b]);
}

// Explicit regional/international air pairs with known gateway anchors; alternatives stay supplied.
const airPairs:[string,string,string[]][]=[
 ['mashhad','istanbul',['dubai']],['shiraz','istanbul',['dubai']],['tabriz','istanbul',['dubai']],['mashhad','dubai',['istanbul']],['shiraz','doha',['dubai']],
 ['istanbul','london',['frankfurt','paris']],['istanbul','paris',['frankfurt']],['istanbul','frankfurt',['london']],['istanbul','dubai',['doha']],
 ['dubai','singapore',['doha','bangkok']],['dubai','bangkok',['singapore']],['dubai','london',['doha','frankfurt']],['dubai','sydney',['singapore']],
 ['doha','london',['istanbul']],['doha','new-york',['london']],['doha','los-angeles',['istanbul','frankfurt']],['doha','bangkok',['dubai']],
 ['singapore','bangkok',['dubai']],['singapore','tokyo',['bangkok']],['singapore','sydney',['tokyo']],['sydney','auckland',['singapore']],
];
for(const [a,b,alternatives]of airPairs)addPair('flight',a,b,undefined,alternatives);

for(const destination of ['van','yerevan','tbilisi','ankara','istanbul']){
 addPair('bus','tehran',destination,['tehran','tabriz',destination]);
 addPair('bus','tabriz',destination);
}
// Ordinary Azerbaijan land entry is closed in the dated official sources; Baku stays air-only.
addPair('bus','van','ankara');
addPair('bus','ankara','istanbul');
addPair('train','tehran','van',['tehran','tabriz','van']);
addPair('train','tabriz','van');
for(const origin of ['tehran','tabriz'])for(const destination of ['ankara','istanbul']){
 const path=[...(origin==='tehran'?['tehran']:[]),'tabriz','van','tatvan','ankara',...(destination==='istanbul'?['istanbul']:[])];
 addPair('train',origin,destination,path);
}
addPair('train','tatvan','ankara');
addPair('train','tatvan','istanbul',['tatvan','ankara','istanbul']);
addPair('train','ankara','istanbul');

export {connections};
export const supportedConnections:SupportedConnection[]=connections.map(({mode,scope,originCityId,destinationCityId})=>({mode,scope,originCityId,destinationCityId}));
export const heroSearches=[
 {mode:'flight',scope:'domestic',destinationCityId:'mashhad'},{mode:'flight',scope:'international',destinationCityId:'istanbul'},
 {mode:'train',scope:'domestic',destinationCityId:'mashhad'},{mode:'train',scope:'international',destinationCityId:'van'},
 {mode:'bus',scope:'domestic',destinationCityId:'isfahan'},{mode:'bus',scope:'international',destinationCityId:'yerevan'},
] as const;
