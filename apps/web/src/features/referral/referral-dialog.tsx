import type {CatalogSnapshot} from '@torob-ticket/contracts';
import {Button,Dialog,Price,displayProviderName} from '@torob-ticket/ui';
import {FareConditions,Breakdown} from '../results/provider-offers';
import {RoomRates} from '../hotels/room-rates';
import {nights} from '../hotels/hotel-format';
import {number} from '../results/format';
import {useReferralController,type ReferralPayload,type ReferralSource} from './referral-controller';
import styles from './referral.module.css';
export function ReferralFacts({payload,catalog}:{payload:ReferralPayload;catalog:CatalogSnapshot}){
 const q=payload.quote;return <div data-checked-quote-id={q.quoteId} data-checked-quote-version={q.version} data-checked-amount-rial={q.total.amountRial}>
 <p>{displayProviderName(catalog.providerCapabilities.find(p=>p.providerId===q.providerId))} · نسخه {number(q.version)}</p>
 {payload.kind==='transport'?<><Price total={payload.quote.total} scope={{kind:'party',travelers:payload.quote.party.adults+payload.quote.party.children+payload.quote.party.infants}}/><FareConditions quote={payload.quote} catalog={catalog}/><details><summary>ریز مبلغ همه مسافران</summary><Breakdown quote={payload.quote}/></details></>:<><p><bdi>{payload.quote.query.checkIn}</bdi> تا <bdi>{payload.quote.query.checkOut}</bdi> · {number(nights(payload.quote.query.checkIn,payload.quote.query.checkOut))} شب</p><RoomRates comparisonEvidence={false} quote={payload.quote} disabled selected onSelect={()=>undefined}/></>}
 </div>;
}
export function ProviderAction({source,flow,catalog,compact=false,layout='standard'}:{source:ReferralSource;flow:ReturnType<typeof useReferralController>;catalog:CatalogSnapshot;compact?:boolean;layout?:'standard'|'ticket'}){
 const payload=source.payload;
 const blocked=flow.needsFresh(source),recovery=flow.hasRecovery(source),expired=Date.parse(source.payload.quote.expiresAt)<=Date.now();
 if(layout==='ticket')return <section className={styles.ticketAction} aria-label="ادامه پیشنهاد انتخاب‌شده" data-referral-source={source.payload.kind}>
 <Button onPress={()=>void flow.start(source)} isDisabled={flow.state.phase!=='idle'}>{recovery?'بررسی نتیجه انتقال قبلی':blocked||expired?'مقایسه تازه همین سفر':<>رفتن به {displayProviderName(catalog.providerCapabilities.find(p=>p.providerId===payload.quote.providerId))}<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg></>}</Button>
 {blocked?<p role="status">این نسخه به مقایسه تازه نیاز دارد.</p>:expired&&!recovery?<p role="status">اعتبار قیمت پایان یافته است.</p>:null}
 </section>;
 return <section className={styles.selected} aria-label="ادامه پیشنهاد انتخاب‌شده" data-referral-source={source.payload.kind}>
 <div><strong>پیشنهاد انتخاب‌شده برای ادامه</strong><p>قیمت و شرایط پیش از ادامه دوباره بررسی می‌شود.</p></div>
 {compact&&<div><strong>{displayProviderName(catalog.providerCapabilities.find(p=>p.providerId===payload.quote.providerId))} · نسخه {number(payload.quote.version)}</strong><Price total={payload.quote.total} scope={payload.kind==='transport'?{kind:'party',travelers:payload.quote.party.adults+payload.quote.party.children+payload.quote.party.infants}:{kind:'stay',rooms:payload.quote.query.rooms,nights:nights(payload.quote.query.checkIn,payload.quote.query.checkOut)}}/></div>}
 {!compact&&<ReferralFacts payload={source.payload} catalog={catalog}/>}
 {blocked?<p role="status">این نسخه به مقایسه تازه نیاز دارد؛ پیشنهادهای قبلی به عنوان سابقه حفظ شده‌اند.</p>:expired&&!recovery?<p role="status">اعتبار قیمت پایان یافته است؛ برای قیمت قابل انتخاب دوباره مقایسه کنید.</p>:null}
 <Button onPress={()=>void flow.start(source)} isDisabled={flow.state.phase!=='idle'}>{recovery?'بررسی نتیجه انتقال قبلی':blocked||expired?'مقایسه تازه همین سفر':'ادامه با فروشنده'}</Button>
 {compact&&<details><summary>مبلغ، شرایط و نسخه دقیق انتخاب برای ادامه</summary><ReferralFacts payload={source.payload} catalog={catalog}/></details>}
 </section>;
}
export function ReferralDialog({flow,catalog}:{flow:ReturnType<typeof useReferralController>;catalog:CatalogSnapshot}){
 const s=flow.state,busy=s.phase==='checking'||s.phase==='confirming';const alternatives=s.source?.alternatives?.().filter(a=>s.alternativeQuoteIds?.includes(a.quoteId))??[];
 return <Dialog isDismissable={false} title={s.phase==='changed'?'شرایط تازه پیشنهاد':'ادامه با فروشنده'} isOpen={s.phase!=='idle'&&s.phase!=='completed'} onOpenChange={open=>{if(!open)flow.cancel();}} mobileFullscreen size={s.phase==='changed'?'wide':'standard'} stickyHeader>
 <div className={styles.dialog} data-referral-phase={s.phase}>
 {busy&&<p role="status">{s.phase==='checking'?'در حال بررسی قیمت و شرایط همین پیشنهاد…':'در حال ثبت ارجاع و دریافت نتیجه…'}</p>}
 {s.error&&<p role="alert">{s.error}</p>}
 {s.phase==='changed'&&s.source&&s.intent&&<><p role="alert">مبلغ یا شرایط نسبت به پیشنهاد انتخاب‌شده تغییر کرده است. هر دو نسخه برای کل مسافران یا همه اتاق‌ها و شب‌هاست؛ پذیرش فقط برای نسخه تازه زیر است.</p><div className={styles.comparison}><section><h3>پیشنهاد قبلی</h3><ReferralFacts payload={s.source.payload} catalog={catalog}/></section><section><h3>نسخه تازه برای پذیرش</h3><ReferralFacts payload={s.intent.quote} catalog={catalog}/></section></div><p>بعضی شرایط هنوز اعلام نشده است؛ جزئیات هر پیشنهاد را بررسی کنید.</p><Button onPress={()=>void flow.accept()}>پذیرش نسخه تازه و ادامه</Button></>}
 {s.phase==='unavailable'&&alternatives.length>0&&<section><h3>پیشنهادهای دیگر همین مقایسه</h3><p>انتخاب هر پیشنهاد، بررسی جداگانه همان قیمت منبع را شروع می‌کند.</p>{alternatives.map(a=><Button variant="secondary" key={a.quoteId} onPress={()=>void flow.chooseAlternative(a)}>{a.label}</Button>)}</section>}
 {s.phase==='retry-confirm'&&<Button onPress={()=>void flow.retryConfirm()}>دریافت نتیجه همان انتقال</Button>}
 {s.phase==='handoff-error'&&<Button onPress={flow.reopenReceipt}>باز کردن صفحه فروشنده</Button>}
 {(s.phase==='refresh-required'||s.phase==='unavailable')&&<Button onPress={flow.freshComparison}>مقایسه تازه همین سفر</Button>}
 <Button variant="quiet" onPress={flow.cancel}>{busy?'بستن و بازگشت به مقایسه':'انصراف و بازگشت به مقایسه'}</Button>
 {busy&&<small>بستن این پنجره، بازگشت درخواست ثبت‌شده در سرور را تضمین نمی‌کند.</small>}
 </div></Dialog>;
}
