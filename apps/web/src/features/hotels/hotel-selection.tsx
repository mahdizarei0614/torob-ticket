import type {ReactNode} from 'react';
import type {Hotel,HotelComparisonResult,HotelQuoteSnapshot} from '@torob-ticket/contracts';
import {MotionText,displayHotelName,displayHotelAddress} from '@torob-ticket/ui';
import {breakfast,cancellation,faNumber,refund,reasonsText,resultLabel} from './hotel-format';
import {HotelPrice} from './hotel-price';
import styles from './hotels.module.css';

export function HotelSelection({hotel,result,quote,pending,continuation,onRefresh}:{hotel:Hotel;result?:HotelComparisonResult;quote?:HotelQuoteSnapshot;pending:boolean;continuation?:ReactNode;onRefresh:()=>void}){
 return <aside className={styles.hotelSelectionDock} aria-label="هتل انتخاب‌شده" data-selected-hotel-id={hotel.hotelId} data-selected-hotel-quote={quote?.quoteId}>
  <div className={styles.selectedHotelIdentity}><strong title={displayHotelName(hotel)}><MotionText value={displayHotelName(hotel)}/></strong>{quote?<div className={styles.squareCardPrice}><HotelPrice quote={quote}/></div>:<small>{pending?'در حال بررسی قیمت…':result?resultLabel(result.status):'قیمت در دسترس نیست'}</small>}</div>
  <details className={styles.hotelSelectionDetails} onKeyDownCapture={event=>{if(event.key==='Escape'&&event.currentTarget.open){event.preventDefault();event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary aria-label={`جزئیات اقامت ${displayHotelName(hotel)}`} title="جزئیات اقامت"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></svg></summary><div className={styles.hotelConditions}>
   <strong>{displayHotelName(hotel)}</strong><p>{displayHotelAddress(hotel)}</p>
   {quote?<><p>{breakfast(quote.terms.breakfast)} · {refund(quote.terms.refundable)}</p><p>{cancellation(quote.terms.cancellation)}</p><ul>{quote.roomAllocation.map(room=>{const detail=quote.roomDetails?.find(item=>item.roomNumber===room.roomNumber);return <li key={room.roomNumber}><strong>{detail?.roomType??'نوع اتاق اعلام نشده'}</strong><span>{faNumber(room.adults)} بزرگسال{room.children?` · ${faNumber(room.children)} کودک`:''}{room.infants?` · ${faNumber(room.infants)} نوزاد`:''}</span>{detail&&<><span>{detail.policy.checkInLocalTime?<>پذیرش از <bdi>{detail.policy.checkInLocalTime}</bdi></>:'ساعت پذیرش اعلام نشده'}؛ ورود زودتر تضمین نمی‌شود.</span><span>{breakfast(detail.terms.breakfast)} · {refund(detail.terms.refundable)}</span><span>{cancellation(detail.terms.cancellation)}</span></>}</li>;})}</ul><p>{quote.terms.fees.status==='complete'?'هزینه‌های اجباری معلوم در مبلغ نهایی منظور شده‌اند.':'بخشی از هزینه اجباری هنوز معلوم نیست.'}</p></>:result?<>{reasonsText(result.reasons).map(reason=><p key={reason}>{reason}</p>)}{result.knownSubtotal&&<p>جمع بخش معلوم، غیرنهایی: {faNumber(result.knownSubtotal.amountRial/10)} تومان؛ قابل انتخاب برای ادامه نیست.</p>}</>:<p>اطلاعات اتاق با قیمت تازه نمایش داده می‌شود.</p>}
  </div></details>
  {continuation?<div className={styles.hotelContinuation}>{continuation}</div>:!pending&&result?.status==='priced'&&!quote?<button type="button" className={styles.refreshHotelPrice} onClick={onRefresh}>قیمت تازه</button>:null}
 </aside>;
}
