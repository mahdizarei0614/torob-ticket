import { HotelSchema, RoomRateSchema, type Hotel, type RoomRate, type Provenance } from '@torob-ticket/contracts';
import { localDateAt } from '@torob-ticket/domain';
import { addDays } from '../calendar';
import { fixtureIdentity } from '../identity';
import { cities } from './cities';
import { materializeRoomRates as legacyRoomRates } from '../legacy-v1/catalog/hotels';
import { materializeRoomRates as previousRoomRates } from '../legacy-v2/catalog/hotels';
const names=['سپیدار','آفتاب','نارون','نیلوفر','آرام','سرو','باران','بامداد','مهتاب','ترنج','افرا','نسترن','دریا','چنار'];
// Fixed authored rial bands for added destinations, not a currency conversion or live hotel price.
const mockPricePercent:Record<string,number>={london:400,paris:350,frankfurt:320,'new-york':400,'los-angeles':400,toronto:350,singapore:300,bangkok:180,tokyo:300,sydney:400,auckland:380};
const provenance=(id:string):Provenance[]=>[{rawRecordId:id,sourceNamespace:'authored-fiction/hotels',sourceValue:'Fictional property and policy; no real hotel affiliation',sourceRevision:'hotel-v1',mappingRevision:'mapping-v1',fixtureVersion:fixtureIdentity.fixtureVersion}];
export const hotels: Hotel[]=cities.flatMap(city=>names.map((name,n)=>HotelSchema.parse({hotelId:`${city.id}-hotel-${String(n+1).padStart(2,'0')}`,destinationCityId:city.id,name:`هتل نمونه ${name} ${city.name} (خیالی)`,point:{longitude:Number((city.point.longitude+(n%5-2)*.007).toFixed(6)),latitude:Number((city.point.latitude+(Math.floor(n/5)-1)*.009).toFixed(6))},stars:n===13?null:2+n%4,address:`محدوده نمایشی ${city.name}، نشانی خیالی ${n+1}`,provenance:provenance(`${city.id}-hotel-${n+1}`)})));
export interface RoomRateTemplate extends Omit<RoomRate,'nightlyPrices'> {
  nightlyTemplate:{offset:number;amountRial:number;availableRooms:number}[];
  policy:{eachRoomRequiresAdult:true;childAgeRequired:true;maxChildAge:number;checkInLocalTime:string;earlyAccessPromised:false};
}
export const roomRateTemplates:RoomRateTemplate[]=hotels.flatMap((hotel,h)=>['یک‌نفره','دو‌نفره','خانوادگی'].map((roomType,r)=>({roomRateId:`${hotel.hotelId}-rate-${r+1}`,hotelId:hotel.hotelId,providerId:`demo-provider-0${h%6+1}`,roomType,maxAdults:r===0?1:r===1?2:3,maxChildren:r===0?0:r,maxInfants:r===0?0:1,infantCountsTowardOccupancy:r===2?{status:'unknown' as const,reason:'سیاست نوزاد اعلام نشده'}:{status:'known' as const,value:r===0},nightlyTemplate:Array.from({length:120},(_,offset)=>({offset,amountRial:(180+h%14*35+r*90+(offset%7===5?70:0))*100000*(mockPricePercent[hotel.destinationCityId]??100)/100,availableRooms:r===0&&offset%17===8?0:r===2?1:4})),terms:{breakfast:h%5===0?{status:'unknown' as const,reason:'اعلام نشده'}:{status:'known' as const,value:r>0},refundable:{status:'known' as const,value:r===2},cancellation:r===2?{status:'known' as const,policyCode:'demo-free-until-48h'}:{status:'unknown' as const,reason:'شرایط کامل اعلام نشده'},fees:h%14===13?{status:'incomplete' as const,missing:['local-mandatory-fee']}:{status:'complete' as const},materialTerms:['هر اتاق حداقل یک بزرگسال','قیمت هر شب برای کل اتاق با هزینه‌های اجباری معلوم','پذیرش زودهنگام تضمین نمی‌شود']},provenance:provenance(`${hotel.hotelId}-rate-${r+1}`),policy:{eachRoomRequiresAdult:true as const,childAgeRequired:true as const,maxChildAge:11,checkInLocalTime:'14:00',earlyAccessPromised:false as const}})));
/** T20 consumes this without tying immutable base rows to the server's current date. */
export function materializeRoomRates(anchorInstant:string,destinationCityId:string,fixtureVersion:string=fixtureIdentity.fixtureVersion):RoomRate[] {
  if(fixtureVersion==='showcase-v1')return legacyRoomRates(anchorInstant,destinationCityId);
  if(fixtureVersion==='showcase-v2')return previousRoomRates(anchorInstant,destinationCityId);
  if(fixtureVersion!==fixtureIdentity.fixtureVersion)throw new RangeError('Unsupported hotel fixture version');
  const city=cities.find(c=>c.id===destinationCityId);if(!city) throw new RangeError('Unknown hotel destination');
  const day0=localDateAt(anchorInstant,city.timeZone);
  const hotelIds=new Set(hotels.filter(h=>h.destinationCityId===destinationCityId).map(h=>h.hotelId));
  return roomRateTemplates.filter(r=>hotelIds.has(r.hotelId)).map(({nightlyTemplate,policy,...rate})=>{
    void policy;
    return RoomRateSchema.parse({...rate,nightlyPrices:nightlyTemplate.map(n=>({date:addDays(day0,n.offset),total:{amountRial:n.amountRial,currency:'IRR'},availableRooms:n.availableRooms}))});
  });
}
