import type { CatalogSnapshot, ComparisonGroup, QuoteSnapshot } from '@torob-ticket/contracts';
import { Button, Price } from '@torob-ticket/ui';
import { number, selectionFor } from './format';
import { quoteStatus, type QuoteSelection, type ResultsState } from './results-reducer';
import styles from './results.module.css';
export function FareConditions({ quote, catalog }: { quote: QuoteSnapshot; catalog: CatalogSnapshot }) {
 return <div className={styles.conditions}>{(['outbound','return'] as const).map(leg => {
  const terms = quote.conditions[leg]; if (!terms) return null;
  const className = catalog.classChoices.find(item => item.code === terms.classCode)?.name ?? terms.classCode;
  return <div key={leg}><strong>{quote.conditions.return ? leg === 'outbound' ? 'رفت · ' : 'برگشت · ' : ''}{className}</strong><ul>
   <li>{terms.checkedBaggageKg.status === 'known' ? `بار تحویلی: ${number(terms.checkedBaggageKg.value)} کیلوگرم` : 'بار تحویلی: نامشخص'}</li>
   <li>{terms.cabinBaggageKg.status === 'known' ? `بار همراه: ${number(terms.cabinBaggageKg.value)} کیلوگرم` : 'بار همراه: نامشخص'}</li>
   <li>{terms.refundable.status === 'known' ? terms.refundable.value ? 'قابل استرداد طبق شرایط فروشنده' : 'غیرقابل استرداد' : 'امکان استرداد: نامشخص'}</li>
   <li>{terms.seatOrBerth.status === 'known' ? `صندلی / تخت: ${terms.seatOrBerth.value}` : 'صندلی / تخت: نامشخص'}</li>
  </ul><details><summary>شرایط و هزینه‌ها{quote.conditions.return ? leg === 'outbound' ? 'ی رفت' : 'ی برگشت' : ''}</summary><p>{terms.cancellation.status === 'known' ? `سیاست لغو فروشنده${terms.cancellation.penalty ? ` · جریمه ${number(terms.cancellation.penalty.amountRial / 10)} تومان` : ''}` : 'جزئیات و جریمه لغو نامشخص است'}</p>{terms.materialTerms.map(term => <p key={term}>{term}</p>)}</details></div>;
 })}</div>;
}
export function Breakdown({ quote }: { quote: QuoteSnapshot }) { return <dl className={styles.breakdown}>{quote.breakdown.map((row,index) => <div key={index}><dt>{({ 'base':'کرایه پایه', 'reported-gross':'مبلغ گزارش‌شده', 'gross':'مبلغ کل', 'mandatory-charge':'هزینه اجباری', 'base-fare':'کرایه پایه', 'mandatory-fee':'هزینه اجباری', 'mandatory-fees':'هزینه‌های اجباری', 'tax':'مالیات' } as Record<string,string>)[row.code] ?? 'جزء اعلام‌شده قیمت'}{row.mandatory ? ' · اجباری' : ' · اختیاری'}</dt><dd>{number(row.amount.amountRial / 10)} تومان</dd></div>)}</dl>; }
export function ProviderOffers({ group, state, now, catalog, onSelect }: { group: ComparisonGroup; state: ResultsState; now: number; catalog: CatalogSnapshot; onSelect: (selection: QuoteSelection) => void }) {
 return <div className={styles.offers}>{group.eligibleQuotes.map(quote => {
  const selection = selectionFor(group.groupId,quote); const status = quoteStatus(state,selection,now);
  const selected = state.selected?.quoteId === quote.quoteId && state.selected.version === quote.version;
  return <section key={quote.quoteId+':'+quote.version} className={styles.offer} data-provider-id={quote.providerId} data-offer-quote-id={quote.quoteId} data-offer-amount-rial={quote.total.amountRial} data-selected={selected || undefined} aria-label={`${catalog.providerCapabilities.find(p => p.providerId === quote.providerId)?.name ?? quote.providerId} · پیشنهاد ${quote.fareId}`}>
   <div className={styles.offerTop}><div><strong>{catalog.providerCapabilities.find(p => p.providerId === quote.providerId)?.name ?? quote.providerId}</strong><small>{catalog.classChoices.find(item => item.code === quote.conditions.outbound.classCode)?.name ?? quote.conditions.outbound.classCode} · مبلغ برای کل گروه</small></div><Price total={quote.total} scope={{ kind:'party', travelers:quote.party.adults+quote.party.children+quote.party.infants }} /></div>
   <FareConditions quote={quote} catalog={catalog} /><details><summary>منبع و نسخه پیشنهاد</summary><p>شناسه شرایط <bdi>{quote.fareId}</bdi> · نسخه {number(quote.version)}</p><p>سیاست لغو: <bdi>{quote.conditions.outbound.cancellation.status === 'known' ? quote.conditions.outbound.cancellation.policyCode : 'اعلام نشده'}</bdi></p></details><details><summary>ریز مبلغ کل</summary><Breakdown quote={quote} /><p className={styles.muted}>تمام هزینه‌های اجباری معلوم در مبلغ کل لحاظ شده‌اند.</p></details>
   <div className={styles.offerAction}><span className={status === 'current' ? styles.muted : styles.invalid}>{status === 'current' ? `مشاهده قیمت: ${new Intl.DateTimeFormat('fa-IR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tehran'}).format(new Date(quote.observedAt))} · اعتبار محدود` : status === 'expired' ? 'اعتبار این قیمت پایان یافته؛ دوباره جست‌وجو کنید.' : 'این نسخه دیگر معتبر نیست؛ نتایج تازه را اعمال کنید.'}</span><Button variant={selected ? 'secondary' : 'primary'} isDisabled={status !== 'current'} aria-pressed={selected} onPress={() => onSelect(selection)}>{selected ? 'پیشنهاد انتخاب‌شده' : 'انتخاب این پیشنهاد'}</Button></div>
  </section>;
 })}{group.incompletePriceOffers.length > 0 && <section className={styles.incomplete} aria-label="پیشنهادهای با قیمت ناقص"><strong>قیمت نهایی نامشخص</strong><p>هزینه‌های اجباری کامل نیست؛ این پیشنهادها در کمترین قیمت و انتخاب لحاظ نمی‌شوند.</p>{group.incompletePriceOffers.map(offer => <div key={offer.offerId}><span>{catalog.providerCapabilities.find(p => p.providerId === offer.providerId)?.name ?? offer.providerId}</span><span>{offer.completeness.status === 'incomplete' ? offer.completeness.missing.map(code => code === 'mandatory-charge' ? 'هزینه اجباری اعلام نشده' : 'بخش نامعلوم مبلغ نهایی').join('، ') : 'شرایط نهایی کامل نیست'}</span></div>)}</section>}</div>;
}
