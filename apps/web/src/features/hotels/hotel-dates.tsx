import {useState} from 'react';
import {parseDate,toCalendar,toCalendarDate,GregorianCalendar,PersianCalendar,type DateValue} from '@internationalized/date';
import {Calendar,CalendarGrid,CalendarGridHeader,CalendarHeaderCell,CalendarGridBody,CalendarCell,Button as AriaButton,Heading,I18nProvider} from 'react-aria-components';
import {Button} from '@torob-ticket/ui';
import type {HotelDiscovery} from './use-hotel-discovery';
import {dateText} from './hotel-format';
import styles from './hotels.module.css';
const persian=(s:string)=>toCalendar(parseDate(s),new PersianCalendar());
const wire=(d:DateValue)=>toCalendar(toCalendarDate(d),new GregorianCalendar()).toString();
export function HotelDates({model,bounds}:{model:HotelDiscovery;bounds:{min:string;lastNight:string;max:string}}){
 const [leg,setLeg]=useState<'checkIn'|'checkOut'|undefined>();const draft=model.state.draft;const value=leg?draft[leg]:'';
 return <div onKeyDownCapture={event=>{if(event.key==='Escape'&&leg){event.preventDefault();event.stopPropagation();setLeg(undefined);}}}>
  <div className={styles.dates}>{(['checkIn','checkOut'] as const).map(key=><div className={styles.dateField} key={key}>
   <span>{key==='checkIn'?'ورود به هتل':'خروج از هتل'}</span><Button variant="secondary" aria-label={key==='checkIn'?'تقویم ورود به هتل':'تقویم خروج از هتل'} onPress={()=>setLeg(leg===key?undefined:key)}>{dateText(draft[key])}</Button>
   <label className={styles.manual}>تاریخ {key==='checkIn'?'ورود':'خروج'} میلادی<input aria-label={key==='checkIn'?'تاریخ ورود به هتل میلادی':'تاریخ خروج از هتل میلادی'} dir="ltr" type="date" value={draft[key]} min={bounds.min} max={key==='checkIn'?bounds.lastNight:bounds.max} onChange={event=>model.edit({[key]:event.target.value,...(key==='checkIn'?{arrivalConfirmed:true}:{})})}/></label>
  </div>)}</div>
  {leg&&<div className={styles.calendar}>
   <I18nProvider locale="fa-IR-u-ca-persian"><Calendar aria-label={leg==='checkIn'?'تقویم جلالی ورود به هتل':'تقویم جلالی خروج از هتل'} createCalendar={()=>new PersianCalendar()} value={value?persian(value):null} defaultFocusedValue={persian(value||draft.checkIn||bounds.min)} minValue={persian(bounds.min)} maxValue={persian(leg==='checkIn'?bounds.lastNight:bounds.max)} onChange={date=>{if(date)model.edit({[leg]:wire(date),...(leg==='checkIn'?{arrivalConfirmed:true}:{})});}}><header><AriaButton slot="previous" aria-label="ماه قبل">‹</AriaButton><Heading/><AriaButton slot="next" aria-label="ماه بعد">›</AriaButton></header><CalendarGrid><CalendarGridHeader>{day=><CalendarHeaderCell>{day}</CalendarHeaderCell>}</CalendarGridHeader><CalendarGridBody>{date=><CalendarCell date={date}/>}</CalendarGridBody></CalendarGrid></Calendar></I18nProvider>
   <Button variant="quiet" onPress={()=>setLeg(undefined)}>بستن تقویم</Button>
  </div>}
  {!model.state.trip.itinerary&&<label className={styles.confirm}><input type="checkbox" checked={draft.arrivalConfirmed} onChange={event=>model.edit({arrivalConfirmed:event.target.checked})}/>این روز، تاریخ رسیدن من به مقصد است.</label>}
  {!model.state.trip.itinerary&&<p className={styles.muted}>تاریخ ورود پیشنهادی از روز حرکت است؛ زمان رسیدن هنوز از بلیت انتخاب‌شده مشخص نشده است.</p>}
 </div>;
}
