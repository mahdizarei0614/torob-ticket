import {HotelSearchQuerySchema,HotelQuoteSnapshotSchema,GeoPointSchema,type CatalogSnapshot,type HotelSearchQuery,type HotelSearchSnapshot,type HotelQuoteSnapshot,type Itinerary,type TransportSearchQuery,type GeoPoint} from '@torob-ticket/contracts';
import {localDateAt,suggestHotelStay} from '@torob-ticket/domain';
import {parseDate} from '@internationalized/date';
export interface HotelTrip {query:TransportSearchQuery; itinerary?:Itinerary; draftKey:string; available:boolean}
export interface HotelDraft {checkIn:string;checkOut:string;rooms:number;childAges:string[];arrivalConfirmed:boolean;sort:HotelSearchQuery['sort'];arrivalPlaceId?:string;customPoint?:GeoPoint}
export interface HotelState {trip:HotelTrip;draft:HotelDraft;revision:number;snapshot?:HotelSearchSnapshot;requested?:HotelSearchQuery;status:'idle'|'loading'|'ready'|'error';error?:string;selected?:HotelQuoteSnapshot;contextBlocked?:boolean;point?:{token:number;value?:GeoPoint}}
export type HotelAction={type:'edit';patch:Partial<HotelDraft>}|{type:'apply-trip';trip:HotelTrip;catalog:CatalogSnapshot}|{type:'start';query:HotelSearchQuery}|{type:'success';revision:number;snapshot:HotelSearchSnapshot}|{type:'failure';revision:number;error:string}|{type:'settle-close'}|{type:'open-point'}|{type:'point';value:GeoPoint}|{type:'cancel-point'}|{type:'apply-point'}|{type:'select';quote:HotelQuoteSnapshot;now:number}|{type:'bind-rechecked';previous:{quoteId:string;version:number};quote:HotelQuoteSnapshot;now:number}|{type:'hydrate';snapshot:HotelSearchSnapshot;draft:HotelDraft;selected?:HotelQuoteSnapshot;contextBlocked?:boolean};
/** Only meaningful travel identity; filter/sort/auth/camera do not rewrite an independent stay. */
export function tripKey(query:TransportSearchQuery){return JSON.stringify([query.mode,query.scope,query.originCityId,query.destinationCityId,query.departureDate,query.returnDate,query.tripType,query.party.adults,query.party.children,query.party.infants,query.party.infantAgesMonths,query.classCode]);}
export function tripStamp(trip:HotelTrip){const arrival=trip.itinerary?.outbound.segments.at(-1),departure=trip.itinerary?.return?.segments[0];return JSON.stringify([tripKey(trip.query),trip.draftKey,trip.available,arrival?.destinationPlaceId,arrival?.arrivalAt,departure?.departureAt]);}
export function createHotelState(trip:HotelTrip,catalog:CatalogSnapshot):HotelState{
 const zone=catalog.cities.find(c=>c.id===trip.query.destinationCityId)?.timeZone??'UTC';
 const suggestion=suggestHotelStay(trip.itinerary,zone);
 return {trip,draft:{checkIn:suggestion.checkIn??trip.query.departureDate,checkOut:suggestion.checkOut??'',rooms:1,childAges:Array.from({length:trip.query.party.children},()=>''),arrivalConfirmed:!suggestion.needsArrivalConfirmation,sort:'cheapest',arrivalPlaceId:suggestion.arrivalPlaceId},revision:0,status:'idle'};
}
export function queryKey(query:HotelSearchQuery){return JSON.stringify(HotelSearchQuerySchema.parse(query));}
export function hotelReducer(state:HotelState,action:HotelAction):HotelState{
 switch(action.type){
 case 'edit':return {...state,draft:{...state.draft,...action.patch},revision:state.revision+1,status:'idle',requested:undefined,error:undefined,selected:undefined};
 case 'apply-trip':return {...createHotelState(action.trip,action.catalog),revision:state.revision+1};
 case 'start':return {...state,revision:state.revision+1,requested:action.query,status:'loading',error:undefined,selected:undefined};
 case 'success':{
  if(action.revision!==state.revision||!state.requested||state.status!=='loading')return state;
  if(queryKey(action.snapshot.query)!==queryKey(state.requested))return {...state,status:'error',requested:undefined,error:'پاسخ برای شرایط همین اقامت نبود؛ دوباره مقایسه کنید.'};
  return {...state,snapshot:action.snapshot,status:'ready',requested:undefined,error:undefined};
 }
 case 'failure':return action.revision===state.revision&&state.status==='loading'?{...state,status:'error',requested:undefined,error:action.error}:state;
 case 'settle-close':return {...state,point:undefined,revision:state.revision+1,requested:undefined,status:state.snapshot?'ready':'idle'};
 case 'open-point':return {...state,revision:state.revision+1,requested:undefined,status:state.status==='loading'?'idle':state.status,point:{token:state.revision+1,value:state.draft.customPoint?{...state.draft.customPoint}:undefined}};
 case 'point':return state.point&&GeoPointSchema.safeParse(action.value).success?{...state,point:{...state.point,value:{...action.value}}}:state;
 case 'cancel-point':return {...state,point:undefined,revision:state.revision+1};
 case 'apply-point':return state.point?.value?{...state,draft:{...state.draft,customPoint:{...state.point.value},sort:'location-distance'},point:undefined,revision:state.revision+1,status:'idle',requested:undefined,selected:undefined,error:undefined}:state;
 case 'hydrate':return {...state,snapshot:action.snapshot,draft:structuredClone(action.draft),selected:action.contextBlocked?undefined:action.selected,contextBlocked:action.contextBlocked,status:'ready',requested:undefined,error:undefined,revision:state.revision+1};
 case 'bind-rechecked':{
  const previous=state.selected,parsed=HotelQuoteSnapshotSchema.safeParse(action.quote);
  if(!previous||!parsed.success||state.status!=='ready'||action.previous.quoteId!==previous.quoteId||action.previous.version!==previous.version)return state;
  const q=parsed.data;
  if(q.quoteId!==previous.quoteId||q.version<=previous.version||q.hotelId!==previous.hotelId||q.providerId!==previous.providerId||queryKey(q.query)!==queryKey(previous.query)||JSON.stringify(q.roomAllocation)!==JSON.stringify(previous.roomAllocation)||Date.parse(q.expiresAt)<=action.now||Date.parse(q.observedAt)>action.now||q.completeness.status!=='complete'||q.eligibility.status!=='eligible')return state;
  return {...state,selected:q};
 }
 case 'select':{
  const q=action.quote;
  if(state.status!=='ready'||!state.snapshot||!state.snapshot.quotes.some(item=>JSON.stringify(item)===JSON.stringify(q))||Date.parse(q.expiresAt)<=action.now||Date.parse(q.observedAt)>action.now||q.completeness.status!=='complete'||q.eligibility.status!=='eligible')return state;
  return {...state,selected:q};
 }
 }
}
export function hotelBounds(anchor:string,zone:string){const min=localDateAt(anchor,zone);return {min,lastNight:parseDate(min).add({days:119}).toString(),max:parseDate(min).add({days:120}).toString()};}
export function arrivalPlaces(trip:HotelTrip,catalog:CatalogSnapshot){const kind=trip.query.mode==='flight'?'airport':trip.query.mode==='train'?'station':'terminal';return catalog.places.filter(p=>p.cityId===trip.query.destinationCityId&&p.kind===kind);}
export function hotelQuery(state:HotelState,catalog:CatalogSnapshot,anchor:string):{query?:HotelSearchQuery;errors:string[]}{
 const {draft,trip}=state;const errors:string[]=[];
 const city=catalog.cities.find(c=>c.id===trip.query.destinationCityId);
 if(!city)errors.push('شهر مقصد مشخص نیست.');
 if(!draft.arrivalConfirmed)errors.push('تاریخ ورود به مقصد را تأیید کنید؛ تاریخ حرکت لزوماً تاریخ رسیدن نیست.');
 if(!draft.checkOut)errors.push('تاریخ خروج از هتل را انتخاب کنید.');
 if(draft.checkIn&&draft.checkOut&&draft.checkOut<=draft.checkIn)errors.push('خروج باید پس از ورود باشد؛ سفر همان‌روز خودکار یک شب نمی‌شود.');
 if(!Number.isInteger(draft.rooms)||draft.rooms<1||draft.rooms>trip.query.party.adults)errors.push('هر اتاق به یک بزرگسال نیاز دارد؛ تعداد اتاق‌ها را اصلاح کنید.');
 if(draft.childAges.length!==trip.query.party.children||draft.childAges.some(a=>!a.trim()||!Number.isInteger(Number(a))||Number(a)<0||Number(a)>17))errors.push('سن هر کودک در روز ورود را جداگانه وارد کنید.');
 if(draft.sort==='arrival-distance'&&!arrivalPlaces(trip,catalog).some(p=>p.id===draft.arrivalPlaceId))errors.push('نقطه رسیدن همین وسیله در مقصد را انتخاب کنید.');
 if(draft.sort==='location-distance'&&!draft.customPoint)errors.push('موقعیت مرجع را انتخاب و اعمال کنید.');
 const party={adults:trip.query.party.adults,children:trip.query.party.children,infants:trip.query.party.infants,...(trip.query.party.infantAgesMonths?{infantAgesMonths:[...trip.query.party.infantAgesMonths]}:{})};
 const parsed=HotelSearchQuerySchema.safeParse({destinationCityId:trip.query.destinationCityId,checkIn:draft.checkIn,checkOut:draft.checkOut,party,...(party.children?{childAgesAtCheckIn:draft.childAges.map(Number)}:{}),rooms:draft.rooms,sort:draft.sort,...(draft.arrivalPlaceId?{arrivalPlaceId:draft.arrivalPlaceId}:{}),...(draft.customPoint?{customPoint:draft.customPoint}:{})});
 if(!parsed.success&&!errors.length)errors.push('تاریخ‌ها و شرایط اقامت را کامل و معتبر کنید.');
 if(parsed.success&&city){const bounds=hotelBounds(anchor,city.timeZone);if(parsed.data.checkIn<bounds.min||parsed.data.checkOut>bounds.max)errors.push('اقامت باید در پوشش ۱۲۰ شب نسخه نمایشی باشد.');}
 return {errors,...(!errors.length&&parsed.success?{query:parsed.data}:{})};
}
export function tripStale(state:HotelState,trip:HotelTrip){return Boolean(state.contextBlocked)||tripStamp(state.trip)!==tripStamp(trip)||!trip.available||trip.draftKey!==tripKey(trip.query);}
