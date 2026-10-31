import {expect,it} from 'vitest';
import {HOTEL_DIRECTORY_SOURCE_REVISION} from '@torob-ticket/contracts';
import {realHotelInventory} from './real-hotel-inventory';
import {cities} from './catalog/cities';
import publishedDirectory from './catalog/real-hotel-directory.json';

// Constructed inputs exercise source authority; production geography comes from
// the separately sourced directory and is never generated from these city points.
function completeDirectory(){return{revision:HOTEL_DIRECTORY_SOURCE_REVISION,retrievedAt:'2026-10-30T00:00:00Z',license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',status:'complete',hotels:cities.map((city,index)=>({hotelId:`constructed-${city.id}`,destinationCityId:city.id,name:`Constructed hotel ${index+1}`,point:city.point,address:null,stars:null,osmType:'node',osmId:index+1,sourceUrl:`https://www.openstreetmap.org/node/${index+1}`,sourceTags:{tourism:'hotel'}}))};}
const input={fixtureVersion:'showcase-v3',destinationCityId:'mashhad'};
it('never activates incomplete research or silently changes older fixture roots',()=>{
 expect(realHotelInventory(input,{status:'draft',hotels:[]})).toBeUndefined();
 expect(realHotelInventory({...input,fixtureVersion:'showcase-v2'},completeDirectory())).toBeUndefined();
});
it('preserves exact sourced identity/location and unknown property facts while separating authored offer provenance',()=>{
 const directory=completeDirectory(),row=directory.hotels.find(hotel=>hotel.destinationCityId==='mashhad')!;
 const inventory=realHotelInventory(input,directory)!;expect(inventory.sourceRevision).toBe(HOTEL_DIRECTORY_SOURCE_REVISION);expect(inventory.hotels).toHaveLength(1);
 expect(inventory.hotels[0]).toMatchObject({hotelId:row.hotelId,name:row.name,point:row.point,stars:null,address:'نشانی کامل اعلام نشده'});
 expect(inventory.hotels[0]!.provenance[0]!.sourceValue).toMatchObject({sourceUrl:row.sourceUrl,point:row.point,license:'ODbL-1.0'});
 expect(inventory.templates).toHaveLength(4);
 for(const template of inventory.templates){const payload=template.payload as {nightlyTemplate:{amountRial:number}[];policy:Record<string,unknown>;terms:Record<string,unknown>;provenance:{sourceNamespace:string}[]};
  expect(payload.policy).not.toHaveProperty('checkInLocalTime');expect(payload.terms).toMatchObject({breakfast:{status:'unknown'},refundable:{status:'unknown'},cancellation:{status:'unknown'}});
  expect(payload.provenance.map(item=>item.sourceNamespace)).toEqual(['openstreetmap/hotel-directory','authored-offers/real-property-room-rates']);expect(payload.nightlyTemplate).toHaveLength(120);expect(payload.nightlyTemplate.every(night=>Number.isSafeInteger(night.amountRial)&&night.amountRial>0)).toBe(true);
 }
});
it('fails closed on missing destination coverage, duplicate identities and misassigned geographic points',()=>{
 const missing=completeDirectory();missing.hotels=missing.hotels.filter(hotel=>hotel.destinationCityId!=='mashhad');expect(()=>realHotelInventory(input,missing)).toThrow(/cover every destination/);
 const duplicate=completeDirectory();duplicate.hotels.push({...duplicate.hotels[0]!});expect(()=>realHotelInventory(input,duplicate)).toThrow(/identity or destination/);
 const wrong=completeDirectory();wrong.hotels.find(hotel=>hotel.destinationCityId==='mashhad')!.point={latitude:0,longitude:0};expect(()=>realHotelInventory(input,wrong)).toThrow(/outside/);
 const unknown=completeDirectory();unknown.hotels[0]!.destinationCityId='unsupported-city';expect(()=>realHotelInventory(input,unknown)).toThrow(/identity or destination/);
});
it.runIf(publishedDirectory.status==='complete')('materializes the published real directory for every current destination without replacing its sourced coordinates',()=>{
 for(const city of cities){
  const source=realHotelInventory({fixtureVersion:'showcase-v3',destinationCityId:city.id})!;
  const expected=publishedDirectory.hotels.filter((hotel:{destinationCityId:string})=>hotel.destinationCityId===city.id) as {hotelId:string;name:string;point:{latitude:number;longitude:number}}[];
  expect(source.sourceRevision).toBe(HOTEL_DIRECTORY_SOURCE_REVISION);
  expect(source.hotels.length).toBeGreaterThan(0);expect(source.hotels).toHaveLength(expected.length);
  expect(source.templates).toHaveLength(expected.length*4);
  for(const hotel of source.hotels){
   const row=expected.find(item=>item.hotelId===hotel.hotelId)!;
   expect(hotel.name).toBe(row.name.trim());expect(hotel.point).toEqual(row.point);
   expect(hotel.provenance[0]!.sourceNamespace).toBe('openstreetmap/hotel-directory');
  }
 }
});
it('appends an independent four-adult room without widening or renaming the original one-to-three-adult templates',()=>{
 const inventory=realHotelInventory(input,completeDirectory())!,hotel=inventory.hotels[0]!;
 const payloads=inventory.templates.map(template=>template.payload as {roomRateId:string;roomType:string;maxAdults:number;maxChildren:number;maxInfants:number;nightlyTemplate:{offset:number;amountRial:number;availableRooms:number}[];provenance:{sourceNamespace:string;sourceValue:unknown}[]});
 expect(payloads.slice(0,3).map(rate=>[rate.roomRateId,rate.roomType,rate.maxAdults,rate.maxChildren,rate.maxInfants])).toEqual([[`${hotel.hotelId}-rate-1`,'اتاق یک‌نفره',1,0,0],[`${hotel.hotelId}-rate-2`,'اتاق دو‌نفره',2,1,1],[`${hotel.hotelId}-rate-3`,'اتاق خانوادگی',3,2,1]]);
 const fourth=payloads[3]!;expect(fourth).toMatchObject({roomRateId:`${hotel.hotelId}-rate-4`,roomType:'اتاق چهار‌نفره',maxAdults:4,maxChildren:0,maxInfants:0});expect(fourth.nightlyTemplate).toHaveLength(120);expect(fourth.nightlyTemplate.every(night=>night.availableRooms===2&&Number.isSafeInteger(night.amountRial))).toBe(true);expect(fourth.nightlyTemplate[0]!.amountRial).toBeGreaterThan(payloads[2]!.nightlyTemplate[0]!.amountRial);
 expect(fourth.provenance.at(-1)).toMatchObject({sourceNamespace:'authored-offers/real-property-room-rates',sourceValue:{kind:'authored-mock-offer',rule:expect.stringContaining('four-adult-one-room')}});
});
