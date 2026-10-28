import type { SearchSnapshot, TransportSearchQuery } from '@torob-ticket/contracts';
import { Button, EmptyRouteIllustration, ProviderDelayIllustration } from '@torob-ticket/ui';
import styles from './results.module.css';

const filterLabels = [
 ['budgetMaxRial','سقف قیمت'], ['departureWindow','ساعت حرکت'], ['providerIds','فروشنده'],
 ['operatorIds','شرکت'], ['maxStopsOrTransfers','توقف و تعویض'], ['checkedBaggageMinKg','بار تحویلی'], ['refundableOnly','استرداد'],
] as const;

/** A terminal status alone is insufficient evidence that no matching journey exists. */
export function completedEmptyCoverage(snapshot: SearchSnapshot): boolean {
 const coverage=snapshot.coverage;
 return ['complete','empty'].includes(snapshot.status) && coverage.complete && coverage.expectedProviderIds.length > 0 &&
  !coverage.failedProviderIds.length && !coverage.pendingProviderIds.length &&
  coverage.expectedProviderIds.every(id=>coverage.successfulProviderIds.includes(id));
}

export function ResultEmptyState({ snapshot, query, unavailable=false, historical=false, onFresh, onEdit, onDate, onClearFilter }: {
 snapshot: SearchSnapshot;
 query: TransportSearchQuery;
 unavailable?: boolean;
 historical?: boolean;
 onFresh?: () => void;
 onEdit: () => void;
 onDate?: () => void;
 onClearFilter?: (key: keyof TransportSearchQuery['filters']) => void;
}) {
 const filters=filterLabels.filter(([key])=>{
  const value=query.filters[key];
  return value !== undefined && value !== false && (!Array.isArray(value) || value.length > 0);
 });
 const complete=!unavailable && completedEmptyCoverage(snapshot);
 const kind=historical ? 'historical' : !complete ? 'unavailable' : filters.length ? 'filter-empty' : 'no-match';
 const title=historical ? 'پیشنهادی در مقایسه قبلی ثبت نشده است' : !complete ? snapshot.status === 'cancelled' ? 'این جست‌وجو متوقف شده است' : 'پاسخ فروشندگان کامل دریافت نشد' : filters.length ? 'پیشنهادی با این فیلترها پیدا نشد' : 'برای این سفر پیشنهادی پیدا نشد';
 const description=historical ? 'شرایط سفر حفظ شده است؛ برای بررسی پیشنهادهای فعلی دوباره جست‌وجو کنید.' : !complete ? 'هنوز نمی‌توان موجودی این سفر را مشخص کرد. دوباره تلاش کنید یا شرایط سفر را تغییر دهید.' : filters.length ? 'در پاسخ فروشندگان، پیشنهادی مطابق شرایط انتخاب‌شده نبود. یک فیلتر را حذف کنید یا تاریخ دیگری را ببینید.' : 'در پاسخ فروشندگان برای این مسیر و تاریخ پیشنهادی نبود. تاریخ دیگری را ببینید یا شرایط سفر را تغییر دهید.';
 return <section className={styles.empty} aria-label="وضعیت پیشنهادهای سفر" data-results-empty={kind}>
  <div className={styles.emptyArt}>{!complete && !historical ? <ProviderDelayIllustration mode={query.mode} size="compact"/> : <EmptyRouteIllustration mode={query.mode} scope={query.scope} size="compact"/>}</div>
  <div className={styles.emptyContent}><h3>{title}</h3><p role="status">{description}</p>
   <div className={styles.emptyActions}>
    {(historical || !complete) && onFresh && <Button variant="secondary" onPress={onFresh}>تلاش دوباره</Button>}
    {complete && onDate && <Button variant="secondary" onPress={onDate}>بررسی تاریخ دیگر</Button>}
    <Button variant="quiet" onPress={onEdit}>تغییر شرایط سفر</Button>
   </div>
   {complete && Boolean(filters.length) && onClearFilter && <div className={styles.emptyFilters} aria-label="تغییر فیلترهای فعال">{filters.map(([key,label])=><Button key={key} variant="quiet" onPress={()=>onClearFilter(key)}>حذف {label}</Button>)}</div>}
  </div>
 </section>;
}
