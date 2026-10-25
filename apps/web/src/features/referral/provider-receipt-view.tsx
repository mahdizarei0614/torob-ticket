import type {CatalogSnapshot,Hotel,HotelQuoteSnapshot,JourneyLeg,QuoteSnapshot,ReferralReceipt} from '@torob-ticket/contracts';
import {Button,Price} from '@torob-ticket/ui';
import {localDay,localTime,minutes,number,toman} from '../results/format';
import {breakfast,cancellation,dateText,nights,refund} from '../hotels/hotel-format';
import styles from './provider-receipt-view.module.css';

export interface ProviderReceiptViewProps {
 receipt:ReferralReceipt;
 catalog?:CatalogSnapshot;
 hotel?:Hotel;
 onReturn:()=>void;
 returnLabel?:string;
 isReturning?:boolean;
}

const breakdownLabel:Record<string,string>={base:'کرایه پایه','base-fare':'کرایه پایه',tax:'مالیات','mandatory-charge':'هزینه اجباری','mandatory-fee':'هزینه اجباری','mandatory-fees':'هزینه‌های اجباری',gross:'مبلغ کل','reported-gross':'مبلغ گزارش‌شده'};
const isHumanText=(value:string)=>/[\u0600-\u06ff\s]/u.test(value);

function MaterialTerms({terms}:{terms:string[]}){
 if(!terms.length)return null;
 return <ul className={styles.notes}>{terms.map((term,index)=><li key={index}>{isHumanText(term)?term:<details><summary>شرط تکمیلی فروشنده؛ شرح آن اعلام نشده است</summary><p>شناسه شرط ثبت‌شده: <bdi dir="ltr">{term}</bdi></p></details>}</li>)}</ul>;
}

function Party({party,hotelAges}:{party:QuoteSnapshot['party'];hotelAges?:number[]|null}){
 const hotel=hotelAges!==undefined;
 const childAges=hotel?hotelAges:party.childAges;
 return <div className={styles.party} aria-label="مسافران نسخه ثبت‌شده">
  <p>{number(party.adults)} بزرگسال · {number(party.children)} کودک · {number(party.infants)} نوزاد</p>
  {party.children>0&&<p>{hotel?'سن کودکان در روز ورود':'سن کودکان در روز سفر'}: {childAges?.length===party.children?`${childAges.map(number).join('، ')} سال`:'نامشخص'}</p>}
  {party.infants>0&&<p>سن نوزادان: {party.infantAgesMonths?.length===party.infants?`${party.infantAgesMonths.map(number).join('، ')} ماه`:'نامشخص'}</p>}
 </div>;
}

function Journey({leg,label,catalog}:{leg:JourneyLeg;label:'رفت'|'برگشت';catalog?:CatalogSnapshot}){
 const place=(id:string)=>catalog?.places.find(item=>item.id===id);
 return <section className={styles.leg} aria-label={`مسیر ${label} ثبت‌شده`}>
  <h3>مسیر {label}</h3>
  <ol className={styles.segments}>{leg.segments.map((segment,index)=><li key={segment.segmentId+':'+index}>
   <div className={styles.segmentHead}><span>بخش {number(index+1)} · {({flight:'پرواز',train:'قطار',bus:'اتوبوس'} as const)[segment.mode]}</span><span className={styles.muted}>{minutes(Math.round((Date.parse(segment.arrivalAt)-Date.parse(segment.departureAt))/60000))}</span></div>
   <div className={styles.endpoints}>
    <div><strong>{place(segment.originPlaceId)?.name??'نام محل اعلام نشده'}</strong>{place(segment.originPlaceId)?.code&&<bdi className={styles.code} dir="ltr">{place(segment.originPlaceId)!.code}</bdi>}<time dateTime={segment.departureAt}>{localDay(segment.departureAt,segment.departureTimeZone)} · {localTime(segment.departureAt,segment.departureTimeZone)}</time><small dir="ltr">{segment.departureTimeZone}</small></div>
    <span className={styles.routeArrow} aria-hidden="true">←</span>
    <div><strong>{place(segment.destinationPlaceId)?.name??'نام محل اعلام نشده'}</strong>{place(segment.destinationPlaceId)?.code&&<bdi className={styles.code} dir="ltr">{place(segment.destinationPlaceId)!.code}</bdi>}<time dateTime={segment.arrivalAt}>{localDay(segment.arrivalAt,segment.arrivalTimeZone)} · {localTime(segment.arrivalAt,segment.arrivalTimeZone)}</time><small dir="ltr">{segment.arrivalTimeZone}</small></div>
   </div>
   <details><summary>شناسه سرویس ثبت‌شده</summary><p>سرویس: <bdi dir="ltr">{segment.serviceId}</bdi> · مجری: <bdi dir="ltr">{segment.operatorId}</bdi></p></details>
  </li>)}</ol>
  {leg.stops.length>0&&<section className={styles.stops} aria-label={`توقف‌های ${label}`}><h4>توقف‌ها به ترتیب اعلام‌شده</h4><ol>{leg.stops.map((stop,index)=><li key={index}>{({connection:'اتصال',dwell:'توقف میانی','technical-stop':'توقف فنی','ground-transfer':'انتقال زمینی'} as const)[stop.kind]} در {place(stop.placeId)?.name??'محل نامشخص'} · {minutes(stop.waitMinutes)} انتظار · {stop.vehicleChange?'با تعویض وسیله':'بدون تعویض وسیله'}</li>)}</ol></section>}
 </section>;
}

function FareTerms({quote,catalog,mode}:{quote:QuoteSnapshot;catalog?:CatalogSnapshot;mode:'flight'|'train'|'bus'}){
 return <section className={styles.card} aria-label="شرایط ثبت‌شده بلیت"><h2>شرایط همین نسخه</h2><div className={styles.termGrid}>{(['outbound','return'] as const).map(leg=>{
  const term=quote.conditions[leg];if(!term)return null;
  const className=catalog?.classChoices.find(item=>item.mode===mode&&item.code===term.classCode)?.name;
  return <section key={leg}><h3>{leg==='outbound'?'رفت':'برگشت'} · {className??'نام کلاس اعلام نشده'}</h3><ul className={styles.facts}>
   <li>{term.checkedBaggageKg.status==='known'?`بار تحویلی: ${number(term.checkedBaggageKg.value)} کیلوگرم`:'بار تحویلی: نامشخص'}</li>
   <li>{term.cabinBaggageKg.status==='known'?`بار همراه: ${number(term.cabinBaggageKg.value)} کیلوگرم`:'بار همراه: نامشخص'}</li>
   <li>{term.refundable.status==='unknown'?'امکان استرداد: نامشخص':term.refundable.value?'قابل استرداد طبق شرایط فروشنده':'غیرقابل استرداد'}</li>
   <li>{term.seatOrBerth.status==='unknown'?'صندلی / تخت: نامشخص':`صندلی / تخت: ${term.seatOrBerth.value}`}</li>
   <li>{term.cancellation.status==='unknown'?'جزئیات و جریمه لغو نامشخص است':`لغو طبق سیاست اعلام‌شده فروشنده${term.cancellation.penalty?` · جریمه ${toman(term.cancellation.penalty.amountRial)}`:''}`}</li>
  </ul>{term.cancellation.status==='known'&&<details><summary>شناسه سیاست لغو ثبت‌شده</summary><bdi dir="ltr">{term.cancellation.policyCode}</bdi></details>}<MaterialTerms terms={term.materialTerms}/></section>;
 })}</div></section>;
}

function HotelStay({quote,catalog,hotel}:{quote:HotelQuoteSnapshot;catalog?:CatalogSnapshot;hotel?:Hotel}){
 const destination=catalog?.cities.find(city=>city.id===quote.query.destinationCityId)?.name;
 const property=hotel?.hotelId===quote.hotelId&&hotel.destinationCityId===quote.query.destinationCityId&&hotel.provenance.some(p=>p.fixtureVersion===quote.fixtureVersion)?hotel:undefined;
 return <>
  <section className={styles.card} aria-label="اقامت ثبت‌شده"><h2>اقامت ثبت‌شده</h2>{property?<><h3>{property.name}</h3><p className={styles.muted}>{property.address}</p><p className={styles.muted}>{property.stars===null?'درجه اقامتگاه: نامشخص':`${number(property.stars)} ستاره اعلام‌شده`}</p></>:<p className={styles.notice}>نام اقامتگاه در اطلاعات این صفحه موجود نیست.</p>}
   <p>شهر مقصد: {destination??'نامشخص'}</p>
   <dl className={styles.stayDates}><div><dt>ورود</dt><dd><time dateTime={quote.query.checkIn}>{dateText(quote.query.checkIn)}</time><bdi dir="ltr">{quote.query.checkIn}</bdi></dd></div><div><dt>خروج</dt><dd><time dateTime={quote.query.checkOut}>{dateText(quote.query.checkOut)}</time><bdi dir="ltr">{quote.query.checkOut}</bdi></dd></div></dl>
   <Party party={quote.query.party} hotelAges={quote.query.childAgesAtCheckIn??null}/>
   <div className={styles.roomList} aria-label="همه اتاق‌های ثبت‌شده">{quote.roomAllocation.map(room=>{const detail=quote.roomDetails?.find(item=>item.roomNumber===room.roomNumber&&item.roomRateId===room.roomRateId);return <section className={styles.room} key={room.roomNumber}><h3>اتاق {number(room.roomNumber)} · {detail?.roomType??'نوع اتاق اعلام نشده'}</h3><p>{number(room.adults)} بزرگسال · {number(room.children)} کودک · {number(room.infants)} نوزاد</p>{room.children>0&&<p>سن کودکان این اتاق در ورود: {room.childAgesAtCheckIn?.length===room.children?`${room.childAgesAtCheckIn.map(number).join('، ')} سال`:'نامشخص'}</p>}{room.infants>0&&<p>سن نوزادان این اتاق: {room.infantAgesMonths?.length===room.infants?`${room.infantAgesMonths.map(number).join('، ')} ماه`:'نامشخص'}</p>}
    {detail?<><ul className={styles.facts}><li>{breakfast(detail.terms.breakfast)}</li><li>{refund(detail.terms.refundable)}</li><li>{cancellation(detail.terms.cancellation)}</li><li>{detail.terms.fees.status==='complete'?'هزینه‌های اجباری معلوم این اتاق کامل اعلام شده‌اند.':'بخشی از هزینه‌های اجباری این اتاق نامشخص است.'}</li><li>حداکثر {number(detail.maxAdults)} بزرگسال، {number(detail.maxChildren)} کودک و {number(detail.maxInfants)} نوزاد</li><li>هر اتاق حداقل یک بزرگسال دارد.</li>{detail.policy.maxOccupants!==undefined&&<li>حداکثر ظرفیت مشترک اعلام‌شده: {number(detail.policy.maxOccupants)} نفر</li>}{room.children>0&&<li>{detail.policy.childAgeRequired?'اعلام سن کودک در روز ورود لازم است':'اعلام سن کودک برای این اتاق الزامی نیست'} · بیشترین سن کودک طبق سیاست اتاق: {number(detail.policy.maxChildAge)} سال</li>}<li>{detail.infantCountsTowardOccupancy.status==='unknown'?'محاسبه نوزاد در ظرفیت اتاق نامشخص است.':detail.infantCountsTowardOccupancy.value?'نوزاد در ظرفیت اتاق شمرده می‌شود.':'نوزاد در ظرفیت مشترک شمرده نمی‌شود.'}</li></ul><p>پذیرش از <bdi dir="ltr">{detail.policy.checkInLocalTime}</bdi>؛ ورود زودهنگام تضمین نمی‌شود.</p><MaterialTerms terms={detail.terms.materialTerms}/></>:<p className={styles.muted}>جزئیات سیاست و ظرفیت این اتاق در داده ثبت‌شده اعلام نشده است.</p>}
   </section>;})}</div>
  </section>
  <section className={styles.card} aria-label="شرایط کلی اقامت"><h2>شرایط کل اقامت</h2><ul className={styles.facts}><li>{breakfast(quote.terms.breakfast)}</li><li>{refund(quote.terms.refundable)}</li><li>{cancellation(quote.terms.cancellation)}</li><li>{quote.terms.fees.status==='complete'?'هزینه‌های اجباری معلوم اقامت کامل اعلام شده‌اند.':'بخشی از هزینه‌های اجباری اقامت نامشخص است.'}</li></ul><MaterialTerms terms={quote.terms.materialTerms}/></section>
 </>;
}

/** Pure immutable receipt presentation. Route, session and navigation authority stay with its caller. */
export function ProviderReceiptView({receipt,catalog,hotel,onReturn,returnLabel='بازگشت به مقایسه سفر',isReturning=false}:ProviderReceiptViewProps){
 const {payload}=receipt,quote=payload.quote;
 const evidenceCatalog=catalog?.fixtureVersion===quote.fixtureVersion?catalog:undefined;
 const provider=evidenceCatalog?.providerCapabilities.find(item=>item.providerId===quote.providerId);
 return <section className={styles.page} lang="fa" dir="rtl" data-referral-id={receipt.referralId} data-referral-kind={payload.kind} data-provider-id={quote.providerId} data-accepted-quote-version={quote.version}>
  <div className={styles.toolbar}><span className={styles.badge}>فروشندهٔ نمایشی</span><Button variant="secondary" onPress={onReturn} isDisabled={isReturning} isLoading={isReturning}>{returnLabel}</Button></div>
  <header className={styles.hero}><span className={styles.eyebrow}>ارجاع به فروشنده ثبت شد</span><h1>{provider?.name??'جزئیات ارجاع به فروشنده'}</h1>{!provider&&<p className={styles.muted}>نام فروشنده در اطلاعات این صفحه موجود نیست.</p>}<p>این صفحه، نسخهٔ نمایشی اطلاعات ارسال‌شده به فروشنده است.</p><p className={styles.disclaimer}>هیچ خرید، رزرو یا پرداختی انجام نشده است.</p></header>
  <section className={styles.summary} aria-label="مبلغ و نسخه پذیرفته‌شده"><div><h2>مبلغ ثبت‌شده در زمان ارجاع</h2><p className={styles.muted}>این مبلغ و شرایط، سابقهٔ همین ارجاع است و ادعای قیمت روز نیست.</p></div><Price total={quote.total} scope={payload.kind==='transport'?{kind:'party',travelers:payload.quote.party.adults+payload.quote.party.children+payload.quote.party.infants}:{kind:'stay',rooms:payload.quote.query.rooms,nights:nights(payload.quote.query.checkIn,payload.quote.query.checkOut)}}/><div className={styles.receiptMeta}><strong>نسخه {number(quote.version)}</strong><span>ثبت ارجاع به وقت تهران: <time dateTime={receipt.confirmedAt}>{new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short'}).format(new Date(receipt.confirmedAt))}</time></span></div></section>
  {payload.kind==='transport'?<><section className={styles.card} aria-label="سفر ثبت‌شده"><h2>{payload.itinerary.return?'بستهٔ کامل رفت‌وبرگشت':'سفر یک‌طرفه'}</h2><Party party={payload.quote.party}/><Journey leg={payload.itinerary.outbound} label="رفت" catalog={evidenceCatalog}/>{payload.itinerary.return&&<Journey leg={payload.itinerary.return} label="برگشت" catalog={evidenceCatalog}/>}</section><FareTerms quote={payload.quote} catalog={evidenceCatalog} mode={payload.itinerary.mode}/></>:<HotelStay quote={payload.quote} catalog={evidenceCatalog} hotel={hotel}/>}
  <section className={styles.card} aria-label="ریز مبلغ ثبت‌شده"><h2>ریز مبلغ ثبت‌شده</h2><dl className={styles.breakdown}>{quote.breakdown.map((line,index)=><div key={index} data-breakdown-code={line.code}><dt>{breakdownLabel[line.code]??'جزء اعلام‌شده قیمت'} · {line.mandatory?'اجباری':'اختیاری'}</dt><dd>{toman(line.amount.amountRial)}</dd></div>)}</dl><p className={styles.muted}>{quote.completeness.status==='complete'?'تمام هزینه‌های اجباری معلوم در مبلغ ثبت‌شده لحاظ شده‌اند.':'کامل بودن هزینه‌ها در اطلاعات ثبت‌شده تأیید نشده است.'}</p></section>
  <footer className={styles.footer}><p>شرکت‌ها، اقامتگاه‌ها و نرخ‌های این نسخه خیالی‌اند. این ارجاع، ثبت خرید یا تبدیل فروش نیست.</p><details><summary>شناسه‌های نسخه ثبت‌شده</summary><dl><div><dt>شناسه ارجاع</dt><dd><bdi dir="ltr">{receipt.referralId}</bdi></dd></div><div><dt>شناسه قیمت</dt><dd><bdi dir="ltr">{quote.quoteId}</bdi></dd></div></dl></details></footer>
 </section>;
}
