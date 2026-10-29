import type { Mode, SupportedConnection } from '@torob-ticket/contracts';
import { cities } from './cities';
import { places } from './places';
export interface Connection extends SupportedConnection { durationMinutes: number; viaCityId?: string; geometry: {type:'LineString';coordinates:number[][]}; }
const heroDuration: Record<string,number> = {'flight:mashhad':90,'flight:istanbul':200,'train:mashhad':720,'train:van':1320,'bus:isfahan':390,'bus:yerevan':1560};
const internationalGround: Record<'train'|'bus',string[]> = {train:['van','ankara','istanbul'],bus:['van','yerevan','tbilisi','baku','ankara','istanbul']};
export function transportPlace(cityId:string,mode:Mode,scope:string) {
  const kind = mode==='flight'?'airport':mode==='train'?'station':'terminal';
  const place = places.find(p=>p.cityId===cityId && p.kind===kind && (cityId!=='tehran'||mode!=='flight'||p.id===(scope==='international'?'ika':'thr')));
  if (!place) throw new RangeError('Unknown transport place');
  return place;
}
const connections: Connection[] = [];
for (const destination of cities.filter(c=>c.id!=='tehran')) {
  for (const mode of ['flight','train','bus'] as const) {
    const scope = destination.countryCode==='IR'?'domestic':'international';
    if (scope==='international' && mode!=='flight' && !internationalGround[mode].includes(destination.id)) continue;
    const origin = cities[0]!;
    const km = Math.hypot((destination.point.longitude-origin.point.longitude)*85,(destination.point.latitude-origin.point.latitude)*111);
    const durationMinutes = heroDuration[`${mode}:${destination.id}`] ?? Math.round((mode==='flight'?50+km/12:km/(mode==='train'?0.9:0.8)+(scope==='international'?240:0))/5)*5;
    for (const reverse of [false,true]) {
      const a = reverse?destination:origin; const b=reverse?origin:destination;
      const ap=transportPlace(a.id,mode,scope).point; const bp=transportPlace(b.id,mode,scope).point;
      const coordinates = [[ap.longitude,ap.latitude],...(mode==='bus'?[[(ap.longitude+bp.longitude)/2+.08,(ap.latitude+bp.latitude)/2-.06]]:[]),[bp.longitude,bp.latitude]];
      connections.push({mode,scope,originCityId:a.id,destinationCityId:b.id,durationMinutes,geometry:{type:'LineString',coordinates},...(scope==='international'&&mode!=='flight'?{viaCityId:'tabriz'}:{})});
    }
  }
}
export { connections };
export const supportedConnections: SupportedConnection[] = connections.map(({mode,scope,originCityId,destinationCityId})=>({mode,scope,originCityId,destinationCityId}));
export const heroSearches = [
  {mode:'flight',scope:'domestic',destinationCityId:'mashhad'}, {mode:'flight',scope:'international',destinationCityId:'istanbul'},
  {mode:'train',scope:'domestic',destinationCityId:'mashhad'}, {mode:'train',scope:'international',destinationCityId:'van'},
  {mode:'bus',scope:'domestic',destinationCityId:'isfahan'}, {mode:'bus',scope:'international',destinationCityId:'yerevan'},
] as const;
