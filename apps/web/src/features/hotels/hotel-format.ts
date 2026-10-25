import type {HotelQuoteSnapshot,HotelComparisonResult} from '@torob-ticket/contracts';
type HotelTerms=HotelQuoteSnapshot['terms'];
import {parseDate} from '@internationalized/date';
export const faNumber=(n:number)=>new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1}).format(n);
export const dateText=(date:string)=>date?new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'}).format(new Date(date+'T12:00:00Z')):'انتخاب نشده';
export const nights=(checkIn:string,checkOut:string)=>checkIn&&checkOut?parseDate(checkOut).compare(parseDate(checkIn)):0;
export const breakfast=(value:HotelTerms['breakfast'])=>value.status==='unknown'?'صبحانه نامشخص':value.value?'صبحانه دارد':'بدون صبحانه';
export const refund=(value:HotelTerms['refundable'])=>value.status==='unknown'?'استرداد نامشخص':value.value?'قابل استرداد طبق شرایط':'غیرقابل استرداد';
export const cancellation=(value:HotelTerms['cancellation'])=>value.status==='unknown'?'شرایط کامل لغو اعلام نشده':value.policyCode==='demo-free-until-48h'?'لغو رایگان تا ۴۸ ساعت پیش از ورود':'شرایط لغو اعلام‌شده؛ برای جزئیات با اقامتگاه بررسی کنید';
const statusText:Record<HotelComparisonResult['status'],string>={priced:'قیمت کامل',ineligible:'اتاق مناسب این مسافران و اقامت نیست',unknown:'اطلاعات لازم برای احراز شرایط کامل نیست',incomplete:'هزینه نهایی کامل اعلام نشده',unavailable:'اتاق در دسترس نیست',failed:'دریافت اطلاعات این اقامتگاه ناموفق بود'};
export const resultLabel=(status:HotelComparisonResult['status'])=>statusText[status];
const reasonText:Record<string,string>={'stay-child-ages-required':'سن کودکان در روز ورود لازم است.','child-age-outside-room-policy':'سن کودک خارج از شرایط اتاق است.','infant-occupancy-unknown':'سیاست ظرفیت نوزاد معلوم نیست.','combined-occupancy-limit-unknown':'ظرفیت مشترک نوزاد و سایر مسافران مشخص نیست.','local-mandatory-fee':'یک هزینه اجباری محلی هنوز مشخص نیست.','missing-room-policy':'شرایط پذیرش اتاق اعلام نشده است.','provider-paused':'فروشنده موقتاً در دسترس نیست.','provider-source-failed':'پاسخ فروشنده ناموفق بود؛ این به معنی نبود اتاق نیست.','night-unavailable':'حداقل یکی از شب‌ها ظرفیت ندارد.','missing-night-inventory':'پوشش تمام شب‌ها موجود نیست.','no-eligible-allocation':'ترکیب کافی اتاق برای همه مسافران پیدا نشد.','hotel-rates-unavailable':'نرخ قابل بررسی در دسترس نیست.'};
export function reasonsText(reasons:string[]){return [...new Set(reasons.map(r=>reasonText[r]??'اطلاعات این ترکیب برای مقایسه کامل کافی نیست.'))];}
