import {GeoPointSchema} from '@torob-ticket/contracts';
import type {GeoPoint} from '@torob-ticket/contracts';
import type {AreaGeometry,SceneMarker} from '@torob-ticket/graphics';
export interface LocationAssets {features:{properties:Record<string,unknown>;geometry:{type:string;coordinates:unknown}}[]}
export async function loadLocationAssets(signal?:AbortSignal):Promise<LocationAssets>{const response=await fetch('/geography/destination-landmarks.geojson',{signal});if(!response.ok)throw Error('Local geography unavailable');const value:unknown=await response.json();if(!value||typeof value!=='object'||!('type' in value)||value.type!=='FeatureCollection'||!('features' in value)||!Array.isArray(value.features))throw Error('Invalid local geography');return {features:value.features.filter((f:unknown):f is LocationAssets['features'][number]=>Boolean(f&&typeof f==='object'&&'properties' in f&&f.properties&&typeof f.properties==='object'&&'geometry' in f&&f.geometry&&typeof f.geometry==='object'))};}
export function cityLocationAssets(assets:LocationAssets,cityId:string):{boundary?:AreaGeometry;landmarks:SceneMarker[]}{
 const features=assets.features.filter(f=>f.properties['cityId']===cityId);let boundary:AreaGeometry|undefined;const landmarks:SceneMarker[]=[];
 for(const f of features){if(f.properties['kind']==='landmark'&&f.geometry.type==='Point'&&Array.isArray(f.geometry.coordinates)){const point=GeoPointSchema.safeParse({longitude:f.geometry.coordinates[0],latitude:f.geometry.coordinates[1]});if(point.success&&typeof f.properties['id']==='string'&&typeof f.properties['name']==='string')landmarks.push({id:f.properties['id'],name:f.properties['name'],point:point.data,kind:'landmark'});}
  if(f.properties['kind']==='illustrative-destination-extent'&&f.geometry.type==='Polygon'&&Array.isArray(f.geometry.coordinates)&&f.geometry.coordinates.length&&f.geometry.coordinates.every(r=>Array.isArray(r)&&r.length>=4&&r.every(p=>Array.isArray(p)&&p.length>=2&&GeoPointSchema.safeParse({longitude:p[0],latitude:p[1]}).success)))boundary={type:'Polygon',coordinates:f.geometry.coordinates as number[][][]};
 }
 return {boundary,landmarks};
}
export const validPoint=(point:unknown):point is GeoPoint=>GeoPointSchema.safeParse(point).success;
