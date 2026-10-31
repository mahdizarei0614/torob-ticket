import {z} from 'zod';
import {HOTEL_DIRECTORY_SOURCE_REVISION,HotelSchema,GeoPointSchema,IdSchema,type Hotel} from '@torob-ticket/contracts';
import {fixtureIdentity} from './identity';
import {straightLineKm} from '@torob-ticket/domain';
import {cities} from './catalog/cities';
import directory from './catalog/real-hotel-directory.json';

const propertySchema=z.object({
 hotelId:IdSchema,destinationCityId:IdSchema,name:IdSchema,point:GeoPointSchema,
 address:IdSchema.nullable(),stars:z.number().int().min(0).max(5).nullable(),
 osmType:z.enum(['node','way','relation']),osmId:z.union([z.string().min(1),z.number().int().positive()]),
 sourceUrl:z.url(),website:z.url().optional(),verifiedUrls:z.array(z.url()).optional(),
 sourceTags:z.record(z.string(),z.string()).optional(),
}).passthrough();
const directorySchema=z.object({revision:z.literal(HOTEL_DIRECTORY_SOURCE_REVISION),retrievedAt:z.string().min(10),license:z.literal('ODbL-1.0'),attribution:z.string().min(1),status:z.literal('complete'),hotels:z.array(propertySchema).min(1)}).passthrough();
export interface RealHotelInventory {
 sourceRevision:string;
 hotels:Hotel[];
 templates:{id:string;hotelId:string;payload:unknown}[];
}
// Authored offer bands, independent of the real geographic directory. These are
// not live hotel prices, exchange rates, property policies or availability feeds.
const pricePercent:Record<string,number>={london:400,paris:350,frankfurt:320,'new-york':400,'los-angeles':400,toronto:350,singapore:300,bangkok:180,tokyo:300,sydney:400,auckland:380};
function bucket(value:string){let hash=2166136261;for(const character of value)hash=Math.imul(hash^character.charCodeAt(0),16777619);return hash>>>0;}

/** Only a complete, verified directory can replace new inventory. Immutable
 * fixture rows and old recorded searches never import or mutate this source. */
export function realHotelInventory(input:{fixtureVersion:string;destinationCityId:string},raw:unknown=directory):RealHotelInventory|undefined {
 if(input.fixtureVersion!==fixtureIdentity.fixtureVersion)return undefined;
 if(!raw||typeof raw!=='object'||!('status'in raw)||raw.status!=='complete')return undefined;
 const source=directorySchema.parse(raw),cityIds=new Set(cities.map(city=>city.id));
 if(new Set(source.hotels.map(hotel=>hotel.hotelId)).size!==source.hotels.length||new Set(source.hotels.map(hotel=>`${hotel.osmType}:${hotel.osmId}`)).size!==source.hotels.length||source.hotels.some(hotel=>!cityIds.has(hotel.destinationCityId)))throw new Error('Invalid real hotel identity or destination');
 if(cities.some(city=>!source.hotels.some(hotel=>hotel.destinationCityId===city.id)))throw new Error('Real hotel directory does not cover every destination');
 if(!cityIds.has(input.destinationCityId))throw new RangeError('Unknown hotel destination');
 if(source.hotels.some(hotel=>straightLineKm(cities.find(city=>city.id===hotel.destinationCityId)!.point,hotel.point)>100))throw new Error('Hotel point is outside its destination region');
 const hotels=source.hotels.filter(row=>row.destinationCityId===input.destinationCityId).sort((a,b)=>a.hotelId.localeCompare(b.hotelId)).map(row=>HotelSchema.parse({
  hotelId:row.hotelId,destinationCityId:row.destinationCityId,name:row.name,point:row.point,
  address:row.address??'نشانی کامل اعلام نشده',stars:row.stars,
  provenance:[{rawRecordId:`osm-${row.osmType}-${row.osmId}`,sourceNamespace:'openstreetmap/hotel-directory',sourceValue:{...row,retrievedAt:source.retrievedAt,license:source.license,attribution:source.attribution},sourceRevision:source.revision,mappingRevision:'mapping-v1',fixtureVersion:input.fixtureVersion}],
 }));
 const templates=hotels.flatMap(hotel=>['اتاق یک‌نفره','اتاق دو‌نفره','اتاق خانوادگی'].map((roomType,index)=>{
  const value=bucket(hotel.hotelId),id=`${hotel.hotelId}-rate-${index+1}`;
  const payload={roomRateId:id,hotelId:hotel.hotelId,providerId:`demo-provider-0${value%6+1}`,roomType,
   maxAdults:index===0?1:index===1?2:3,maxChildren:index===0?0:index,maxInfants:index===0?0:1,
   infantCountsTowardOccupancy:{status:'unknown',reason:'سیاست ظرفیت نوزاد اعلام نشده'},
   nightlyTemplate:Array.from({length:120},(_,offset)=>({offset,amountRial:(180+value%14*35+index*90+(offset%7===5?70:0))*100000*(pricePercent[hotel.destinationCityId]??100)/100,availableRooms:index===0&&offset%17===8?0:index===2?1:4})),
   terms:{breakfast:{status:'unknown',reason:'شرایط صبحانه اعلام نشده'},refundable:{status:'unknown',reason:'شرایط استرداد اعلام نشده'},cancellation:{status:'unknown',reason:'شرایط لغو اعلام نشده'},fees:{status:'complete'},materialTerms:['هر اتاق حداقل یک بزرگسال','هزینه‌های اجباری معلوم در مبلغ پیشنهاد منظور شده‌اند','ساعت پذیرش و شرایط خدمات نیاز به بررسی دارد','پذیرش زودهنگام تضمین نمی‌شود']},
   provenance:[...hotel.provenance,{rawRecordId:id,sourceNamespace:'authored-offers/real-property-room-rates',sourceValue:{kind:'authored-mock-offer',propertySource:hotel.provenance[0]!.rawRecordId,roomType,rule:'120-night-integer-rial-bands; no real property rate, policy or availability verification'},sourceRevision:source.revision,mappingRevision:'mapping-v1',fixtureVersion:input.fixtureVersion}],
   policy:{eachRoomRequiresAdult:true,childAgeRequired:true,maxChildAge:11,earlyAccessPromised:false},
  };
  return{id,hotelId:hotel.hotelId,payload};
 }));
 // Append the newly authored four-adult offer without changing any original
 // room IDs/payloads. Recorded sources replay their own stored template list.
 for(const hotel of hotels){
  const original=templates.find(template=>template.id===`${hotel.hotelId}-rate-3`)!;
  const value=bucket(hotel.hotelId),id=`${hotel.hotelId}-rate-4`,roomType='اتاق چهار‌نفره';
  templates.push({id,hotelId:hotel.hotelId,payload:{...original.payload,
   roomRateId:id,roomType,maxAdults:4,maxChildren:0,maxInfants:0,
   nightlyTemplate:Array.from({length:120},(_,offset)=>({offset,amountRial:(450+value%14*35+(offset%7===5?70:0))*100000*(pricePercent[hotel.destinationCityId]??100)/100,availableRooms:2})),
   provenance:[...hotel.provenance,{rawRecordId:id,sourceNamespace:'authored-offers/real-property-room-rates',sourceValue:{kind:'authored-mock-offer',propertySource:hotel.provenance[0]!.rawRecordId,roomType,rule:'four-adult-one-room; 120-night-integer-rial-bands; no real property rate, policy or availability verification'},sourceRevision:source.revision,mappingRevision:'mapping-v1',fixtureVersion:input.fixtureVersion}],
  }});
 }
 return{sourceRevision:source.revision,hotels,templates};
}
