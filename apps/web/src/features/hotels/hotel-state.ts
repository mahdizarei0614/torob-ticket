import {HotelSearchQuerySchema,HotelQuoteSnapshotSchema,GeoPointSchema,type CatalogSnapshot,type HotelSearchQuery,type HotelSearchSnapshot,type HotelQuoteSnapshot,type Itinerary,type TransportSearchQuery,type GeoPoint} from '@torob-ticket/contracts';
import {localDateAt} from '@torob-ticket/domain';
import {parseDate} from '@internationalized/date';
export interface HotelTrip {query:TransportSearchQuery; itinerary?:Itinerary; draftKey:string; available:boolean}
/** Retained shape supports old return checkpoints; current dates/room count are automatic. */
export interface HotelDraft {checkIn:string;checkOut:string;rooms:number;childAges:string[];arrivalConfirmed:boolean;sort:HotelSearchQuery['sort'];arrivalPlaceId?:string;customPoint?:GeoPoint}
export interface HotelState {trip:HotelTrip;draft:HotelDraft;revision:number;snapshot?:HotelSearchSnapshot;requested?:HotelSearchQuery;status:'idle'|'loading'|'ready'|'error';error?:string;selectedHotelId?:string;selected?:HotelQuoteSnapshot;authorityStale?:boolean;contextBlocked?:boolean;point?:{token:number;value?:GeoPoint;returnStatus?:HotelState['status']}}
export type HotelAction={type:'authority'}|{type:'edit';patch:Partial<HotelDraft>}|{type:'apply-trip';trip:HotelTrip;catalog:CatalogSnapshot}|{type:'start';query:HotelSearchQuery}|{type:'success';revision:number;snapshot:HotelSearchSnapshot;now?:number}|{type:'failure';revision:number;error:string}|{type:'settle-close'}|{type:'open-point'}|{type:'point';value:GeoPoint}|{type:'cancel-point'}|{type:'apply-point'}|{type:'select-hotel';hotelId:string;now:number}|{type:'select';quote:HotelQuoteSnapshot;now:number}|{type:'bind-rechecked';previous:{quoteId:string;version:number};quote:HotelQuoteSnapshot;now:number}|{type:'hydrate';snapshot:HotelSearchSnapshot;draft:HotelDraft;selected?:HotelQuoteSnapshot;authorityStale?:boolean;contextBlocked?:boolean};
/** Meaningful travel identity; filter/sort/auth/camera are not arrival facts. */
export function tripKey(query:TransportSearchQuery){return JSON.stringify([query.mode,query.scope,query.originCityId,query.destinationCityId,query.departureDate,query.returnDate,query.tripType,query.party.adults,query.party.children,query.party.infants,query.party.infantAgesMonths,query.classCode]);}
export function tripStamp(trip:HotelTrip){const arrival=trip.itinerary?.outbound.segments.at(-1),departure=trip.itinerary?.return?.segments[0];return JSON.stringify([tripKey(trip.query),trip.draftKey,trip.available,trip.itinerary?.itineraryId,arrival?.destinationPlaceId,arrival?.arrivalAt,departure?.departureAt]);}
export function arrivalPlace(trip:HotelTrip,catalog:CatalogSnapshot){
 const segment=trip.itinerary?.outbound.segments.at(-1),kind=trip.query.mode==='flight'?'airport':trip.query.mode==='train'?'station':'terminal';
 if(!segment||trip.itinerary?.mode!==trip.query.mode)return undefined;
 return catalog.places.find(place=>place.id===segment.destinationPlaceId&&place.cityId===trip.query.destinationCityId&&place.kind===kind);
}
export function createHotelState(trip:HotelTrip,catalog:CatalogSnapshot):HotelState{
 const city=catalog.cities.find(c=>c.id===trip.query.destinationCityId),arrival=trip.itinerary?.outbound.segments.at(-1),place=arrivalPlace(trip,catalog);
 const checkIn=city&&arrival&&place&&Number.isFinite(Date.parse(arrival.arrivalAt))?localDateAt(arrival.arrivalAt,city.timeZone):'';
 return {trip,draft:{checkIn,checkOut:checkIn?parseDate(checkIn).add({days:1}).toString():'',rooms:1,childAges:Array.from({length:trip.query.party.children},()=>''),arrivalConfirmed:Boolean(checkIn&&place),sort:'cheapest',arrivalPlaceId:place?.id},revision:0,status:'idle'};
}
export function queryKey(query:HotelSearchQuery){return JSON.stringify(HotelSearchQuerySchema.parse(query));}
function currentQuote(quote:HotelQuoteSnapshot|undefined,now:number){return quote&&Number.isFinite(Date.parse(quote.expiresAt))&&Date.parse(quote.expiresAt)>now&&Date.parse(quote.observedAt)<=now&&quote.completeness.status==='complete'&&quote.eligibility.status==='eligible'?quote:undefined;}
function representative(snapshot:HotelSearchSnapshot,hotelId:string,now:number){const row=snapshot.results?.find(result=>result.hotelId===hotelId);return row?.status==='priced'?currentQuote(snapshot.quotes.find(quote=>quote.quoteId===row.representativeQuoteId&&quote.hotelId===hotelId),now):undefined;}
export function hotelReducer(state:HotelState,action:HotelAction):HotelState{
 switch(action.type){
 case 'authority':return {...state,revision:state.revision+1,authorityStale:true,selected:undefined,requested:undefined,status:state.snapshot?'ready':'idle',error:undefined};
 case 'edit':{
  // Setup fields are arrival-derived. Legacy callers cannot turn this view into
  // a different stay or change the known arrival while keeping a hotel quote.
  const patch={...(action.patch.sort?{sort:action.patch.sort}:{}),...('customPoint'in action.patch?{customPoint:action.patch.customPoint}:{})};
  const nextSort=patch.sort??state.draft.sort,nextPoint='customPoint'in patch?patch.customPoint:state.draft.customPoint;
  const samePoint=nextPoint===state.draft.customPoint||Boolean(nextPoint&&state.draft.customPoint&&nextPoint.latitude===state.draft.customPoint.latitude&&nextPoint.longitude===state.draft.customPoint.longitude);
  if(!Object.keys(patch).length||(nextSort===state.draft.sort&&samePoint))return state;
  return {...state,draft:{...state.draft,...patch},revision:state.revision+1,status:'idle',requested:undefined,error:undefined,selected:undefined};
 }
 case 'apply-trip':{
  const next=createHotelState(action.trip,action.catalog),sameCity=state.trip.query.destinationCityId===action.trip.query.destinationCityId;
  return {...next,revision:state.revision+1,...(sameCity?{draft:{...next.draft,sort:state.draft.sort,customPoint:state.draft.customPoint},selectedHotelId:state.selectedHotelId}:{})};
 }
 case 'start':return {...state,revision:state.revision+1,requested:action.query,status:'loading',error:undefined,selected:undefined};
 case 'success':{
  if(action.revision!==state.revision||!state.requested||state.status!=='loading')return state;
  if(queryKey(action.snapshot.query)!==queryKey(state.requested))return {...state,status:'error',requested:undefined,error:'پاسخ برای همین اقامت یک‌شبه نبود؛ دوباره تلاش کنید.'};
  const selectedHotelId=state.selectedHotelId&&action.snapshot.hotels.some(hotel=>hotel.hotelId===state.selectedHotelId)?state.selectedHotelId:undefined;
  return {...state,snapshot:action.snapshot,status:'ready',authorityStale:false,contextBlocked:false,requested:undefined,error:undefined,selectedHotelId,selected:selectedHotelId?representative(action.snapshot,selectedHotelId,action.now??Date.now()):undefined};
 }
 case 'failure':return action.revision===state.revision&&state.status==='loading'?{...state,status:'error',requested:undefined,error:action.error}:state;
 case 'settle-close':return {...state,point:undefined,revision:state.revision+1,requested:undefined,status:state.snapshot?'ready':'idle'};
 case 'open-point':return {...state,revision:state.revision+1,requested:undefined,status:state.status==='loading'?'idle':state.status,point:{token:state.revision+1,value:state.draft.customPoint?{...state.draft.customPoint}:undefined,returnStatus:state.status==='loading'?(state.snapshot?'ready':'idle'):state.status}};
 case 'point':return state.point&&GeoPointSchema.safeParse(action.value).success?{...state,point:{...state.point,value:{...action.value}}}:state;
 case 'cancel-point':return {...state,point:undefined,revision:state.revision+1,status:state.point?.returnStatus??state.status};
 case 'apply-point':return state.point?.value?{...state,draft:{...state.draft,customPoint:{...state.point.value},sort:'location-distance'},point:undefined,revision:state.revision+1,status:'idle',requested:undefined,selected:undefined,error:undefined}:state;
 case 'hydrate':{
  const sameArrival=action.draft.checkIn===state.draft.checkIn;
  const draft={...state.draft,sort:action.draft.sort,customPoint:action.draft.customPoint,...(sameArrival?{childAges:[...action.draft.childAges]}:{})};
  const q=action.snapshot.query;
  const matches=Boolean(!action.contextBlocked&&draft.arrivalConfirmed&&q.destinationCityId===state.trip.query.destinationCityId&&q.checkIn===draft.checkIn&&q.checkOut===draft.checkOut&&q.rooms===1&&q.arrivalPlaceId===draft.arrivalPlaceId&&q.party.adults===state.trip.query.party.adults&&q.party.children===state.trip.query.party.children&&q.party.infants===state.trip.query.party.infants&&JSON.stringify(q.party.infantAgesMonths??[])===JSON.stringify(state.trip.query.party.infantAgesMonths??[])&&q.sort===draft.sort&&JSON.stringify(q.customPoint)===JSON.stringify(draft.customPoint)&&JSON.stringify(q.childAgesAtCheckIn??[])===JSON.stringify(draft.childAges.map(Number)));
  const parsed=HotelQuoteSnapshotSchema.safeParse(action.selected),candidate=parsed.success?action.selected:undefined;
  const original=candidate&&action.snapshot.quotes.find(quote=>quote.quoteId===candidate.quoteId&&quote.hotelId===candidate.hotelId&&quote.providerId===candidate.providerId);
  const parsedOriginal=HotelQuoteSnapshotSchema.safeParse(original);
  const lineage=Boolean(candidate&&original&&parsed.success&&parsedOriginal.success&&candidate.version>=original.version&&queryKey(candidate.query)===queryKey(original.query)&&JSON.stringify(parsed.data.roomAllocation)===JSON.stringify(parsedOriginal.data.roomAllocation)&&Date.parse(candidate.observedAt)>=Date.parse(original.observedAt)&&(candidate.version>original.version||JSON.stringify(parsed.data)===JSON.stringify(parsedOriginal.data)));
  const selected=matches&&candidate&&lineage&&currentQuote(candidate,Date.now())?candidate:undefined;
  return {...state,snapshot:matches?action.snapshot:undefined,draft,selected,selectedHotelId:selected?.hotelId,authorityStale:Boolean(action.authorityStale),contextBlocked:Boolean(action.contextBlocked),status:matches?'ready':'idle',requested:undefined,error:undefined,revision:state.revision+1};
 }
 case 'bind-rechecked':{
  const previous=state.selected,parsed=HotelQuoteSnapshotSchema.safeParse(action.quote);
  if(!previous||!parsed.success||state.status!=='ready'||action.previous.quoteId!==previous.quoteId||action.previous.version!==previous.version)return state;
  const q=parsed.data;
  if(q.quoteId!==previous.quoteId||q.version<=previous.version||q.hotelId!==previous.hotelId||q.providerId!==previous.providerId||queryKey(q.query)!==queryKey(previous.query)||JSON.stringify(q.roomAllocation)!==JSON.stringify(previous.roomAllocation)||!currentQuote(q,action.now))return state;
  return {...state,selected:q,selectedHotelId:q.hotelId};
 }
 case 'select-hotel':{
  if(state.authorityStale||state.contextBlocked||state.status!=='ready'||!state.snapshot||!state.snapshot.hotels.some(hotel=>hotel.hotelId===action.hotelId))return state;
  const retained=state.selected?.hotelId===action.hotelId&&currentQuote(state.selected,action.now)&&queryKey(state.selected.query)===queryKey(state.snapshot.query)?state.selected:undefined;
  return {...state,selectedHotelId:action.hotelId,selected:retained??representative(state.snapshot,action.hotelId,action.now)};
 }
 case 'select':{
  const q=action.quote;
  if(state.authorityStale||state.contextBlocked||state.status!=='ready'||!state.snapshot||!state.snapshot.quotes.some(item=>JSON.stringify(item)===JSON.stringify(q))||!currentQuote(q,action.now)||(state.selected?.quoteId===q.quoteId&&state.selected.version>q.version))return state;
  return {...state,selected:q,selectedHotelId:q.hotelId};
 }
 }
}
export function hotelBounds(anchor:string,zone:string){const min=localDateAt(anchor,zone);return {min,lastNight:parseDate(min).add({days:119}).toString(),max:parseDate(min).add({days:120}).toString()};}
export function arrivalPlaces(trip:HotelTrip,catalog:CatalogSnapshot){const place=arrivalPlace(trip,catalog);return place?[place]:[];}
export function hotelQuery(state:HotelState,catalog:CatalogSnapshot,anchor:string):{query?:HotelSearchQuery;errors:string[]}{
 const {draft,trip}=state,expected=createHotelState(trip,catalog).draft;const errors:string[]=[];
 const city=catalog.cities.find(c=>c.id===trip.query.destinationCityId);
 if(!city)errors.push('شهر مقصد مشخص نیست.');
 if(!expected.arrivalConfirmed)errors.push('برای نمایش هتل‌ها، بلیت سفر با زمان و محل رسیدن مشخص انتخاب کنید.');
 if(expected.arrivalConfirmed&&(draft.checkIn!==expected.checkIn||draft.checkOut!==expected.checkOut||draft.rooms!==1||draft.arrivalPlaceId!==expected.arrivalPlaceId||!draft.arrivalConfirmed))errors.push('اقامت باید از روز رسیدن همین بلیت و برای یک شب باشد.');
 if(draft.childAges.length!==trip.query.party.children||draft.childAges.some(a=>!a.trim()||!Number.isInteger(Number(a))||Number(a)<0||Number(a)>17))errors.push('سن معتبر کودکان در روز ورود برای این اقامت مشخص نیست.');
 if(draft.sort==='location-distance'&&!draft.customPoint)errors.push('موقعیت مرجع را روی نقشه انتخاب کنید.');
 const party={adults:trip.query.party.adults,children:trip.query.party.children,infants:trip.query.party.infants,...(trip.query.party.infantAgesMonths?{infantAgesMonths:[...trip.query.party.infantAgesMonths]}:{})};
 const parsed=HotelSearchQuerySchema.safeParse({destinationCityId:trip.query.destinationCityId,checkIn:expected.checkIn,checkOut:expected.checkOut,party,...(party.children?{childAgesAtCheckIn:draft.childAges.map(Number)}:{}),rooms:1,sort:draft.sort,...(expected.arrivalPlaceId?{arrivalPlaceId:expected.arrivalPlaceId}:{}),...(draft.customPoint?{customPoint:draft.customPoint}:{})});
 if(!parsed.success&&!errors.length)errors.push('شرایط معتبر اقامت یک‌شبه در دسترس نیست.');
 if(parsed.success&&city){const bounds=hotelBounds(anchor,city.timeZone);if(parsed.data.checkIn<bounds.min||parsed.data.checkOut>bounds.max)errors.push('روز رسیدن این بلیت خارج از محدوده موجودی هتل‌هاست.');}
 return {errors,...(!errors.length&&parsed.success?{query:parsed.data}:{})};
}
export function tripStale(state:HotelState,trip:HotelTrip){return Boolean(state.contextBlocked)||tripStamp(state.trip)!==tripStamp(trip)||!trip.available||trip.draftKey!==tripKey(trip.query);}
