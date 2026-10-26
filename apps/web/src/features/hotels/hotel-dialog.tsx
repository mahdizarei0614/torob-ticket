import {useLayoutEffect,useRef,type ReactNode} from 'react';
import type {CatalogSnapshot,SessionInfo} from '@torob-ticket/contracts';
import {Button,Dialog,SegmentedControl,displayHotelName,displayPlaceName} from '@torob-ticket/ui';
import {suggestHotelStay} from '@torob-ticket/domain';
import type {HotelDiscovery} from './use-hotel-discovery';
import {arrivalPlaces,hotelBounds,queryKey} from './hotel-state';
import {HotelDates} from './hotel-dates';
import {HotelCard} from './hotel-card';
import {LocationPicker} from './location-picker';
import {dateText,faNumber,nights} from './hotel-format';
import styles from './hotels.module.css';
export function HotelDialog({model,catalog,session,canApplyTrip,referralAction,initialScrollTop}:{model:HotelDiscovery;catalog:CatalogSnapshot;session:SessionInfo;canApplyTrip:boolean;referralAction?:{quoteId:string;node:ReactNode};initialScrollTop?:number}){
 const locationTrigger=useRef<HTMLDivElement>(null);const cycle=useRef({open:model.open,epoch:0});const focusRequest=useRef<number|undefined>(undefined);if(cycle.current.open!==model.open){cycle.current={open:model.open,epoch:cycle.current.epoch+1};focusRequest.current=undefined;}
 useLayoutEffect(()=>{if(!model.state.point&&model.open&&focusRequest.current===cycle.current.epoch){focusRequest.current=undefined;locationTrigger.current?.querySelector('button')?.focus({preventScroll:true});}},[model.state.point,model.open]);const {state}=model,trip=state.trip,draft=state.draft,snapshot=state.snapshot;
 const revealedQuote=useRef(state.selected?.quoteId);
 useLayoutEffect(()=>{const id=state.selected?.quoteId;if(!id||revealedQuote.current===id||referralAction?.quoteId!==id)return;const action=document.querySelector<HTMLButtonElement>('[data-referral-source=hotel] button');if(!action||action.disabled)return;revealedQuote.current=id;action.focus({preventScroll:true});action.scrollIntoView({block:'nearest',behavior:'instant'});},[state.selected?.quoteId,referralAction?.quoteId]);
 const city=catalog.cities.find(c=>c.id===trip.query.destinationCityId)!;const bounds=hotelBounds(session.anchorInstant,city.timeZone);
 const places=arrivalPlaces(trip,catalog);const modeLabel=trip.query.mode==='flight'?'فرودگاه':trip.query.mode==='train'?'ایستگاه':'پایانه';
 const fresh=Boolean(snapshot&&model.query&&queryKey(snapshot.query)===queryKey(model.query)&&state.status==='ready'&&!model.stale);
 const policyTimes=[...new Set(snapshot?.quotes.flatMap(q=>q.roomDetails?.map(d=>d.policy.checkInLocalTime)??[])??[])];
 const early=policyTimes.filter(time=>{const suggested=suggestHotelStay(trip.itinerary,city.timeZone,time);return suggested.earlyArrival&&suggested.checkIn===draft.checkIn;});
 function focusLocation(){focusRequest.current=cycle.current.epoch;}
 function cancelPoint(){focusLocation();model.cancelPoint();}
 function applyPoint(){focusLocation();void model.applyPoint();}
 return <Dialog title={`مقایسه اقامتگاه‌های ${city.name}`} isOpen={model.open} initialScrollTop={initialScrollTop} onOpenChange={next=>{if(!next)model.closeDialog();}} mobileFullscreen stickyHeader size="wide">
  <div className={styles.dialogContent} data-hotel-dialog data-hotel-context={trip.query.destinationCityId} data-hotel-stale={model.stale}>
   <div className={styles.intro}><span className={styles.eyebrow}>بعد از مسیر، مقصد را زندگی کن</span><p>اقامتگاه‌ها را برای همه مسافران و تمام شب‌های سفر مقایسه کنید.</p></div>
   {model.stale&&<aside className={styles.stale} role="status"><strong>{model.contextBlocked?'زمینه قبلی اقامت قابل تأیید نیست؛ پیش‌نویس حفظ شد.':'سفر تغییر کرده است؛ اقامت مستقل شما حفظ شد.'}</strong>{model.contextBlocked?<p>شواهد قبلی برای ادامه کافی نیست. سفر کنونی را اعمال و اقامت را دوباره مقایسه کنید.</p>:<p>این مقایسه هنوز برای سفر قبلی به {city.name} از {dateText(draft.checkIn)} تا {dateText(draft.checkOut)} است. قیمت یا اتاق قبلی تا اعمال سفر تازه قابل انتخاب نیست.</p>}<Button variant="secondary" onPress={model.applyTrip} isDisabled={!canApplyTrip}>{model.contextBlocked?'آماده‌سازی اقامت برای سفر کنونی':'استفاده از سفر جدید'}</Button>{!canApplyTrip&&<p>ابتدا سفر تازه را در فرم اصلی کامل و مقایسه کنید؛ سپس این تغییر را اعمال کنید.</p>}</aside>}
   {state.point&&!model.stale?<LocationPicker model={model} catalog={catalog} onCancel={cancelPoint} onApply={applyPoint}/>:<>
    <form aria-label="شرایط اقامت هتل" className={styles.form} onSubmit={event=>{event.preventDefault();void model.submit();}}>
     <fieldset disabled={model.stale} className={styles.formFields}>
      <HotelDates model={model} bounds={bounds}/>
      <div className={styles.party}><strong>{faNumber(trip.query.party.adults)} بزرگسال{trip.query.party.children?`، ${faNumber(trip.query.party.children)} کودک`:''}{trip.query.party.infants?`، ${faNumber(trip.query.party.infants)} نوزاد`:''}</strong><label>تعداد اتاق<input aria-label="تعداد اتاق هتل" type="number" inputMode="numeric" min="1" max={trip.query.party.adults} value={draft.rooms} onChange={event=>model.edit({rooms:event.target.valueAsNumber})}/></label><small>هر اتاق حداقل یک بزرگسال دارد.</small></div>
      {draft.childAges.length>0&&<div className={styles.ages}><p>سن در روز ورود به هتل؛ مستقل از سن درج‌شده برای بلیت</p>{draft.childAges.map((age,index)=><label key={index}>سن کودک {faNumber(index+1)} در ورود<input aria-label={`سن کودک ${index+1} در روز ورود به هتل`} type="number" min="0" max="17" value={age} onChange={event=>model.edit({childAges:draft.childAges.map((a,i)=>i===index?event.target.value:a)})}/></label>)}</div>}
      <div className={styles.references}><label className={styles.field}>{modeLabel} رسیدن در {city.name}<select aria-label="نقطه رسیدن برای فاصله هتل" value={draft.arrivalPlaceId??''} onChange={event=>model.edit({arrivalPlaceId:event.target.value||undefined})}><option value="">انتخاب کنید؛ فاصله هنوز مشخص نیست</option>{places.map(place=><option key={place.id} value={place.id}>{displayPlaceName(place)}{place.code?` (${place.code})`:''}</option>)}</select></label><div ref={locationTrigger}><Button variant="secondary" onPress={model.openPoint}>انتخاب موقعیت روی نقشه</Button>{draft.customPoint&&<p className={styles.muted}>موقعیت مرجع اعمال شده · فاصله خط مستقیم</p>}</div></div>
     </fieldset>
     <div className={styles.formActions}><Button type="submit" isDisabled={!model.query||model.stale||state.status==='loading'} isLoading={state.status==='loading'}>مقایسه اقامتگاه‌ها</Button><span>{draft.checkIn&&draft.checkOut&&nights(draft.checkIn,draft.checkOut)>0?`${faNumber(nights(draft.checkIn,draft.checkOut))} شب · مجموع ${faNumber(draft.rooms)} اتاق`:'ورود و خروج را مشخص کنید'}</span></div>
     {model.errors.length>0&&!model.stale&&<ul className={styles.validation} aria-label="موارد لازم برای مقایسه هتل">{model.errors.map(error=><li key={error}>{error}</li>)}</ul>}
    </form>
    <div className={styles.sorts}><SegmentedControl label="مرتب‌سازی اقامتگاه‌ها" value={draft.sort} isDisabled={model.stale||state.status==='loading'} onChange={value=>{void model.changeSort(value as typeof draft.sort);}} options={[{id:'cheapest',label:'کمترین هزینه اقامت'},{id:'stars',label:'ستاره بیشتر'},{id:'arrival-distance',label:`نزدیک به ${modeLabel}`},{id:'location-distance',label:'نزدیک به موقعیت من'}]}/></div>
    {early.length>0?<p className={styles.note}>زمان رسیدن شما پیش از ساعت پذیرش اعلام‌شده برای برخی اتاق‌ها ({early.join('، ')}) است؛ ورود زودهنگام تضمین نمی‌شود. شرایط هر اتاق را بررسی کنید.</p>:<p className={styles.muted}>زمان پذیرش به شرایط هر اتاق بستگی دارد؛ ورود زودهنگام تضمین نمی‌شود.</p>}
    {state.status==='loading'&&<div role="status" className={styles.loading}><span/>در حال بررسی اتاق‌ها و همه شب‌های اقامت…</div>}
    {state.error&&<div role="alert" className={styles.stale}><p>{state.error}</p><Button variant="secondary" isDisabled={!model.query||model.stale} onPress={()=>void model.submit()}>تلاش دوباره برای اقامتگاه‌ها</Button></div>}
    {snapshot&&!fresh&&state.status!=='loading'&&<p role="status" className={styles.note}>شرایط اقامت تغییر کرده است؛ برای قیمت قابل انتخاب، دوباره مقایسه کنید.</p>}
    {model.selected&&<div className={styles.selection} role="status" data-selected-hotel-quote={model.selected.quoteId}><strong>ترکیب اتاق برای بررسی انتخاب شد</strong><p>{displayHotelName(snapshot?.hotels.find(h=>h.hotelId===model.selected?.hotelId))} · مجموع {faNumber(model.selected.total.amountRial/10)} تومان برای همه اتاق‌ها و شب‌ها.</p></div>}
    {snapshot&&<section aria-label="نتایج مقایسه اقامتگاه‌ها" className={styles.results} data-hotel-search-id={snapshot.hotelSearchId} data-hotel-query={queryKey(snapshot.query)} data-hotel-status={snapshot.status}>
     <header className={styles.resultHead}><h2>{snapshot.status==='failed'?'دریافت اقامتگاه‌ها کامل نشد':snapshot.status==='empty'?'اقامت کامل مطابق این شرایط پیدا نشد':`${faNumber(snapshot.results?.filter(r=>r.status==='priced').length??0)} اقامتگاه با قیمت کامل`}</h2><p>{snapshot.status==='empty'?'تعداد اتاق، سن کودکان یا تاریخ‌ها را بررسی کنید. اطلاعات ناقص با نبود اتاق یکسان نیست.':snapshot.status==='failed'?'دریافت ناموفق به معنی نبود اتاق نیست؛ دوباره تلاش کنید.':'مبلغ اصلی برای همه اتاق‌ها و همه شب‌هاست.'}</p></header>
     {snapshot.results?.map(result=>{const hotel=snapshot.hotels.find(h=>h.hotelId===result.hotelId);return hotel?<HotelCard referralAction={referralAction} key={hotel.hotelId} hotel={hotel} result={result} quotes={snapshot.quotes.filter(q=>q.hotelId===hotel.hotelId)} catalog={catalog} disabled={!fresh} selected={model.selected} onSelect={model.selectQuote}/>:null;})}
    </section>}
    <p className={styles.footnote}>فاصله‌ها خط مستقیم‌اند؛ نقشه شهری برای انتخاب موقعیت است و مسیر رانندگی را نشان نمی‌دهد.</p>
   </>}
  </div>
 </Dialog>;
}
