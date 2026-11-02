import {useCallback,useId,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {GeoPointSchema,type GeoPoint,type CatalogSnapshot,type SessionInfo} from '@torob-ticket/contracts';
import {Button,Dialog,SegmentedControl,displayHotelName,displayPlaceName,LoadingSkeleton,ContentSwap,ContentItem,HotelStayIllustration,useMotionPolicy} from '@torob-ticket/ui';
import type {HotelDiscovery} from './use-hotel-discovery';
import {hotelCapacity,hotelCapacityOptions,queryKey} from './hotel-state';
import {HotelCard} from './hotel-card';
import {HotelSelection} from './hotel-selection';
import {FreeLocationMap} from './free-location-map';
import type {MapChoice} from './free-map-adapter';
import {faNumber} from './hotel-format';
import styles from './hotels.module.css';

function discoveryScrollHost(panel:HTMLDivElement){
 const layout=panel.closest<HTMLDivElement>('[data-hotel-layout]');
 return layout&&['auto','scroll'].includes(getComputedStyle(layout).overflowY)?layout:panel;
}

function CoordinateReference({model,initial,onCommit,onCancel}:{model:HotelDiscovery;initial?:GeoPoint;onCommit:(point:GeoPoint)=>void;onCancel:()=>void}){
 const [latitude,setLatitude]=useState(initial?String(initial.latitude):''),[longitude,setLongitude]=useState(initial?String(initial.longitude):''),[attempted,setAttempted]=useState(false);
 const latitudeInput=useRef<HTMLInputElement>(null),longitudeInput=useRef<HTMLInputElement>(null),errorId=useId();
 const latitudeValid=latitude.trim()!==''&&Number.isFinite(Number(latitude))&&Number(latitude)>=-90&&Number(latitude)<=90;
 const longitudeValid=longitude.trim()!==''&&Number.isFinite(Number(longitude))&&Number(longitude)>=-180&&Number(longitude)<=180;
 const value=GeoPointSchema.safeParse({latitude:Number(latitude),longitude:Number(longitude)}),valid=latitudeValid&&longitudeValid&&value.success;
 return <details className={styles.referenceCoordinates} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onCancel();}}}>
  <summary>انتخاب با مختصات</summary>
  <form noValidate aria-label="مختصات نقطه مرجع" onSubmit={event=>{event.preventDefault();if(!model.isPointCurrent())return;setAttempted(true);if(!valid||!value.success){(!latitudeValid?latitudeInput:longitudeInput).current?.focus();return;}onCommit(value.data);}}>
   <div className={styles.referenceCoordinateFields}>
    <label>عرض جغرافیایی<input ref={latitudeInput} type="number" inputMode="decimal" dir="ltr" min="-90" max="90" step="any" aria-label="عرض جغرافیایی نقطه مرجع" value={latitude} aria-invalid={attempted&&!latitudeValid||undefined} aria-describedby={attempted&&!valid?errorId:undefined} onChange={event=>setLatitude(event.target.value)}/></label>
    <label>طول جغرافیایی<input ref={longitudeInput} type="number" inputMode="decimal" dir="ltr" min="-180" max="180" step="any" aria-label="طول جغرافیایی نقطه مرجع" value={longitude} aria-invalid={attempted&&!longitudeValid||undefined} aria-describedby={attempted&&!valid?errorId:undefined} onChange={event=>setLongitude(event.target.value)}/></label>
   </div>
   {attempted&&!valid&&<p id={errorId} className={styles.referenceCoordinateError} role="alert">عرض جغرافیایی باید بین ۹۰- تا ۹۰ و طول جغرافیایی بین ۱۸۰- تا ۱۸۰ باشد.</p>}
   <Button type="submit" variant="secondary" isDisabled={model.stale||model.blocked}>اعمال نقطه مرجع</Button>
  </form>
 </details>;
}

export function HotelDialog({model,catalog,referralAction,initialScrollTop=0}:{model:HotelDiscovery;catalog:CatalogSnapshot;session:SessionInfo;canApplyTrip:boolean;referralAction?:{quoteId:string;node:ReactNode};initialScrollTop?:number}){
 const {state}=model,trip=state.trip,draft=state.draft,policy=useMotionPolicy();
 const capacity=hotelCapacity(state),adultCapacity=Boolean(trip.query.party.children||trip.query.party.infants);
 const city=catalog.cities.find(item=>item.id===trip.query.destinationCityId);
 const segment=trip.itinerary?.outbound.segments.at(-1);
 const arrival=catalog.places.find(place=>place.id===segment?.destinationPlaceId&&place.cityId===trip.query.destinationCityId);
 const modeLabel=trip.query.mode==='flight'?'فرودگاه':trip.query.mode==='train'?'ایستگاه راه‌آهن':'پایانه اتوبوس';
 const arrivalName=arrival?displayPlaceName(arrival):'';
 const arrivalCode=arrival?.code&&!arrivalName.toLocaleUpperCase().includes(arrival.code.toLocaleUpperCase())?arrival.code:undefined;
 const identity=[trip.query.destinationCityId,arrival?.id??'awaiting-arrival'].join(':');
 const ownership=useRef({identity,open:model.open});ownership.current={identity,open:model.open};
 const isMapCurrent=useCallback(()=>ownership.current.open&&ownership.current.identity===identity,[identity]);
 const order=useRef<HTMLDivElement>(null),pointReturnFocus=useRef(false);
 useLayoutEffect(()=>{if(!model.open){pointReturnFocus.current=false;return;}if(!state.point&&pointReturnFocus.current){pointReturnFocus.current=false;order.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked:not(:disabled)')?.focus();}},[model.open,state.point]);
 function cancelPoint(){if(!model.isPointCurrent())return;pointReturnFocus.current=true;model.cancelPoint();}
 function commitPoint(value:GeoPoint){if(!model.isPointCurrent())return;pointReturnFocus.current=true;void model.chooseLocation(value);}
 const scroll=useRef<HTMLDivElement>(null),restored=useRef(false);
 const bindScroll=useCallback((node:HTMLDivElement|null)=>{scroll.current=node;if(node&&!restored.current){node.scrollTop=initialScrollTop;restored.current=true;}},[initialScrollTop]);
 useLayoutEffect(()=>{if(!model.open){restored.current=false;return;}if(scroll.current&&!restored.current){scroll.current.scrollTop=initialScrollTop;restored.current=true;}},[model.open,initialScrollTop]);
 const snapshot=state.snapshot;
 const sameQuery=Boolean(snapshot&&model.query&&queryKey(snapshot.query)===queryKey(model.query));
 const visible=sameQuery&&!model.stale?snapshot:undefined;
 const [moreBelow,setMoreBelow]=useState(false),errorKey=model.errors.join('|');
 useLayoutEffect(()=>{
  const panel=scroll.current;if(!model.open||!panel){setMoreBelow(false);return;}
  let live=true;
  const layout=panel.closest<HTMLDivElement>('[data-hotel-layout]');
  const update=()=>{if(live){const host=discoveryScrollHost(panel);setMoreBelow(host.clientHeight>0&&host.scrollHeight-host.clientHeight-host.scrollTop>2);}};
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(update);
  observer?.observe(panel);for(const child of Array.from(panel.children))observer?.observe(child);
  if(layout)observer?.observe(layout);
  panel.addEventListener('scroll',update,{passive:true});layout?.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);void document.fonts?.ready.then(update);update();
  return()=>{live=false;observer?.disconnect();panel.removeEventListener('scroll',update);layout?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
 },[model.open,state.status,visible,state.selectedHotelId,errorKey]);
 const fresh=Boolean(visible&&state.status==='ready'&&!model.stale&&!model.authorityStale&&!model.blocked&&!state.point);
 const hotels=useMemo(()=>(snapshot?.hotels??[]).filter(hotel=>hotel.destinationCityId===trip.query.destinationCityId),[snapshot?.hotels,trip.query.destinationCityId]);
 const choices=useMemo<MapChoice[]>(()=>[
  ...(arrival?[{id:`arrival:${arrival.id}`,name:arrivalName,point:arrival.point,kind:'arrival' as const,code:arrivalCode,mode:trip.query.mode}]:[]),
  ...hotels.map(hotel=>({id:hotel.hotelId,name:displayHotelName(hotel),point:hotel.point,kind:'hotel' as const})),
 ],[arrival,arrivalName,arrivalCode,hotels,trip.query.mode]);
 const selectedHotel=hotels.find(hotel=>hotel.hotelId===state.selectedHotelId);
 const selectedResult=visible?.results?.find(result=>result.hotelId===state.selectedHotelId);
 const selectedQuote=fresh?model.selected:undefined;
 const loading=state.status==='loading';
 const failed=visible?.status==='failed';
 const priced=visible?.results?.filter(result=>result.status==='priced').length??0;
 function pickHotel(id:string){
  if(!fresh||model.readState()!==state||!ownership.current.open||ownership.current.identity!==identity)return;
  model.selectHotel(id);
  if(model.readState().selectedHotelId!==id)return;
  const panel=scroll.current;
  const card=Array.from(panel?.querySelectorAll<HTMLElement>('[data-hotel-id]')??[]).find(node=>node.dataset['hotelId']===id&&!node.closest('[inert],[data-content-presence="exiting"]'));
  if(!panel||!card)return;
  const host=discoveryScrollHost(panel),viewport=host.getBoundingClientRect(),box=card.getBoundingClientRect();
  const top=viewport.top+8,bottom=viewport.bottom-4;
  const delta=box.top<top?box.top-top:box.bottom>bottom?box.bottom-bottom:0;
  if(Math.abs(delta)>1)host.scrollTo({top:Math.max(0,host.scrollTop+delta),behavior:policy.enabled?'smooth':'instant'});
 }
 const sort=useCallback((value:string)=>{
  if(value==='location-distance'){model.openPoint();return;}
  void model.changeSort(value as typeof draft.sort);
 },[model]);
 return <Dialog title={`هتل‌های ${city?.name??'مقصد'}`} isOpen={model.open} onOpenChange={next=>{if(!next)model.closeDialog();}} mobileFullscreen stickyHeader size="wide">
  <div className={styles.arrivalDialog} data-hotel-dialog data-motion-enabled={policy.enabled} data-hotel-authority-stale={model.authorityStale} data-hotel-blocked={model.blocked} data-hotel-context={trip.query.destinationCityId} data-hotel-stale={model.stale} data-hotel-check-in={model.query?.checkIn??''} data-hotel-check-out={model.query?.checkOut??''} data-selected-hotel-id={state.selectedHotelId}>
   <div className={styles.hotelSplitFrame}>
   <div className={styles.hotelSplit} data-hotel-layout="split">
    <div className={styles.hotelMapPane} data-hotel-map-pane>
    <div className={styles.arrivalMapFrame} data-hotel-map-frame>
     {arrival?<FreeLocationMap identity={identity} active={model.open} variant="discovery" center={arrival.point} choices={choices} selectedHotelId={state.selectedHotelId} onSelectHotel={pickHotel} pickingPoint={Boolean(state.point)} point={state.point?.value??draft.customPoint} onPoint={model.chooseLocation} isCurrent={isMapCurrent}/>:<div className={styles.arrivalWaiting} role="status"><HotelStayIllustration size="compact"/><strong>هتل‌ها پس از مشخص شدن محل رسیدن نمایش داده می‌شوند</strong><span>محل رسیدن این بلیت هنوز مشخص نیست.</span></div>}
    </div>
    {state.point&&<div className={styles.referencePrompt}><div className={styles.referencePromptBar}><span role="status">نقطه دلخواه را انتخاب کنید</span><Button variant="quiet" onPress={cancelPoint}>انصراف</Button></div><CoordinateReference key={identity+':'+state.point.token} model={model} initial={state.point.value??draft.customPoint??arrival?.point??city?.point} onCommit={commitPoint} onCancel={cancelPoint}/></div>}
    </div>
    <div className={styles.hotelCollectionPane} data-hotel-cards-pane>
     <div ref={order} className={styles.hotelOrder}>
      <SegmentedControl hideLabel label="مرتب‌سازی اقامتگاه‌ها" value={state.point?'location-distance':draft.sort} isDisabled={model.stale||model.blocked} onChange={sort} onReselect={sort} options={[{id:'cheapest',label:'ارزان‌ترین'},{id:'stars',label:'ستاره بیشتر'},{id:'arrival-distance',label:`نزدیک به ${modeLabel}`},{id:'location-distance',label:'نزدیک به نقطه دلخواه'}]}/>
      <label className={styles.hotelCapacity}><span className={styles.srOnly}>{adultCapacity?'ظرفیت بزرگسال':'ظرفیت اتاق'}</span><span className={styles.capacitySelect}><select aria-label={adultCapacity?'ظرفیت بزرگسال':'ظرفیت اتاق'} title={adultCapacity?'ظرفیت بزرگسال اتاق؛ کودکان و نوزادان مطابق سفر انتخاب‌شده':'ظرفیت اتاق'} value={capacity} disabled={!draft.arrivalConfirmed||model.stale||model.blocked||Boolean(state.point)} onChange={event=>void model.changeCapacity(Number(event.target.value))}>{hotelCapacityOptions(capacity).map(value=><option key={value} value={value}>اتاق {faNumber(value)} {adultCapacity?'بزرگسال':'نفره'}</option>)}</select><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg></span></label>
     </div>
     {draft.customPoint&&!state.point&&<div className={styles.referenceChange}><Button variant="quiet" isDisabled={loading||model.stale||model.blocked} onPress={model.openPoint}>تغییر نقطه مرجع</Button></div>}
     <div className={styles.hotelScrollFrame}>
     <div ref={bindScroll} className={styles.hotelDiscoveryScroll} data-hotel-scroll tabIndex={0} role="region" aria-label="فهرست اقامتگاه‌ها">
    {(state.status==='error'||model.authorityStale||failed)&&<aside className={styles.arrivalRecovery} role="alert"><div><strong>{model.authorityStale?'قیمت هتل‌ها به بررسی تازه نیاز دارد':'دریافت هتل‌ها کامل نشد'}</strong><p>{state.error??(failed?'پاسخ ناموفق به معنی نبود اتاق نیست. دوباره بررسی کنید.':'همین یک شب و موقعیت انتخابی حفظ شده است.')}</p></div>{model.blocked&&model.resumeSession?<Button variant="secondary" onPress={model.resumeSession}>بازیابی نشست</Button>:<Button variant="secondary" isDisabled={!model.query||model.stale||model.blocked} onPress={()=>void model.submit()}>تلاش دوباره</Button>}</aside>}
    {!model.query&&!loading&&model.errors.length>0&&<p role="status" className={styles.arrivalUnavailable}>{model.errors.join(' ')}</p>}
    <section aria-label="نتایج مقایسه اقامتگاه‌ها" className={styles.arrivalResults} data-hotel-search-id={visible?.hotelSearchId} data-hotel-query={visible?queryKey(visible.query):undefined} data-hotel-status={visible?.status??(loading?'loading':'idle')} aria-busy={loading}>
     <div className={styles.hotelResultsHeading}><h2>{visible?`${faNumber(visible.hotels.length)} هتل در ${city?.name??'مقصد'}`:'هتل‌های نزدیک محل رسیدن'}</h2>{visible&&<span>{faNumber(priced)} قیمت کامل · فاصله خط مستقیم</span>}</div>
     <ContentSwap identity={loading?'loading':visible?.hotelSearchId??'waiting'}>
      {loading?<div className={styles.hotelCardGrid} role="status" aria-label="در حال دریافت هتل‌ها"><span className={styles.srOnly}>در حال دریافت هتل‌ها و قیمت یک شب…</span>{Array.from({length:10},(_,index)=><div key={index} className={styles.squareHotelSkeleton} aria-hidden="true"><LoadingSkeleton compact rows={3}/></div>)}</div>:visible?.results?.length?<div className={styles.hotelCardGrid} role="list" aria-label="هتل‌ها و قیمت اقامت">{visible.results.map(result=>{const hotel=visible.hotels.find(item=>item.hotelId===result.hotelId);return hotel?<ContentItem key={hotel.hotelId} layout><div role="listitem"><HotelCard hotel={hotel} result={result} quotes={visible.quotes.filter(quote=>quote.hotelId===hotel.hotelId)} catalog={catalog} disabled={!fresh} selected={selectedQuote} isSelected={state.selectedHotelId===hotel.hotelId} distanceTo={draft.sort==='location-distance'?'location':'arrival'} onSelectHotel={model.selectHotel} onSelect={model.selectQuote}/></div></ContentItem>:null;})}</div>:state.status!=='error'&&visible?.status==='empty'?<div className={styles.hotelEmpty} role="status"><HotelStayIllustration size="compact"/><strong>برای این شب اقامتگاهی با شرایط کامل پیدا نشد</strong><p>زمان رسیدن و شهر مقصد بلیت شما مبنای همین مقایسه است.</p><Button variant="secondary" onPress={()=>void model.submit()}>بررسی دوباره</Button></div>:null}
     </ContentSwap>
    </section>
     </div>
     </div>
    </div>
   </div>
   <div className={styles.hotelOverflowCue} data-hotel-overflow-cue data-visible={moreBelow} aria-hidden="true"/>
   </div>
   <ContentSwap identity={selectedHotel&&!state.point&&!model.stale?'selection':'no-selection'}>{selectedHotel&&!state.point&&!model.stale&&<HotelSelection hotel={selectedHotel} result={selectedResult} quote={selectedQuote} pending={loading} continuation={selectedQuote&&referralAction?.quoteId===selectedQuote.quoteId?referralAction.node:undefined} onRefresh={()=>void model.submit()}/>}</ContentSwap>
  </div>
 </Dialog>;
}
