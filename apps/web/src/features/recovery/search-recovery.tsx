import type { CatalogSnapshot, SearchStatus } from '@torob-ticket/contracts';
import { errorPolicy } from '@torob-ticket/client';
import { EmptyRouteIllustration, ProviderDelayIllustration, RecoveryState, type RecoveryAction } from '@torob-ticket/ui';
import type { SearchDraft } from '../search/search-url';
export interface SearchRecoveryProps { query: SearchDraft; catalog: CatalogSnapshot; status?: SearchStatus; error?: unknown; historical?: boolean; expired?:boolean;quoteExpired?:boolean; connection?: string; busy?: boolean; onFresh?: () => void; onRead?: () => void; onEdit: () => void; onDate?: () => void; onResume?: () => void; onRoute?: (origin: string, destination: string) => void; onClearFilter?: (key: keyof SearchDraft['filters']) => void }
export function SearchRecovery({ query, catalog, status, error, historical, expired,quoteExpired, connection, busy, onFresh, onRead, onEdit, onDate, onResume, onRoute, onClearFilter }: SearchRecoveryProps) {
  const policy = error ? errorPolicy(error, 'read') : undefined;
  const offline = connection === 'snapshot-only' || connection === 'recovering' || connection === 'unavailable';
  const title = expired?'برای ادامه نشست را بازیابی کنید':quoteExpired?'مهلت قیمت‌های این مقایسه پایان یافته است':historical ? 'شواهد مقایسه قبلی حفظ شده‌اند' : policy?.title.fa ?? (offline ? 'ارتباط زنده برقرار نیست' : status === 'collecting' ? 'در حال بررسی فروشندگان' : status === 'empty' ? 'پیشنهاد مطابق شرایط پیدا نشد' : status === 'interrupted' ? 'بررسی قبلی با توقف سرویس پایان یافته است' : status === 'partial' ? 'پوشش مقایسه کامل و موفق نیست' : 'دریافت پیشنهاد کامل نشد');
  const description = expired?'فرم سفر و اقامت شما حفظ شده‌اند. با بازیابی نشست، سپس مقایسه تازه ادامه دهید.':quoteExpired?'زمان و مبلغ مشاهده قبلی حفظ شده است؛ برای انتخاب یا ادامه، قیمت تازه بگیرید.':historical ? 'تنظیمات یا نشست تغییر کرده است. فرم سفر و اقامت شما حفظ شدند؛ قیمت و انتخاب قبلی برای ادامه معتبر نیست.' : policy?.detail.fa ?? (offline ? 'پاسخ‌های دریافت‌شده حفظ شده‌اند. وضعیت از خواندن مستقیم سرور بازیابی می‌شود؛ خطای ارتباط به معنی نبود بلیت نیست.' : status === 'empty' ? 'در پاسخ‌های موفق، پیشنهادی مطابق همین شرایط پیدا نشد. تاریخ یا فقط فیلتر موردنظر را خودتان تغییر دهید.' : 'فقط پاسخ‌های واقعی دریافت‌شده قابل بررسی‌اند؛ دریافت ناموفق، نبود بلیت را ثابت نمی‌کند.');
  const actions: RecoveryAction[] = [];
  if ((expired||policy?.kind === 'expired') && onResume) actions.push({ id: 'resume', label: 'بازیابی نشست و حفظ فرم', onPress: onResume });
  else {
    if (offline && onRead) actions.push({ id: 'read', label: 'خواندن دوباره وضعیت', onPress: onRead });
    if (onFresh) actions.push({ id: 'fresh', label: 'مقایسه تازه با شرایط فرم', onPress: onFresh });
  }
  if (onDate) actions.push({ id: 'date', label: 'بررسی تاریخ دیگر', onPress: onDate });
  actions.push({ id: 'edit', label: 'ویرایش شرایط سفر', onPress: onEdit });
  if (onClearFilter) for (const [key, label] of [['budgetMaxRial', 'سقف قیمت'], ['refundableOnly', 'استرداد'], ['checkedBaggageMinKg', 'بار تحویلی'], ['maxStopsOrTransfers', 'توقف و تعویض'], ['departureWindow', 'ساعت حرکت'], ['providerIds', 'فروشنده'], ['operatorIds', 'شرکت']] as const) if (query.filters[key] !== undefined) actions.push({ id: 'filter-' + key, label: `حذف فقط فیلتر ${label} و مقایسه`, onPress: () => onClearFilter(key) });
  const routes = catalog.supportedConnections.filter(row => row.mode === query.mode && row.scope === query.scope).slice(0, 3);
  const unsupported = !catalog.supportedConnections.some(row => row.mode === query.mode && row.scope === query.scope && row.originCityId === query.originCityId && row.destinationCityId === query.destinationCityId);
  if (unsupported && onRoute) for (const route of routes) actions.push({ id: route.originCityId + '/' + route.destinationCityId, label: `انتخاب مسیر ${catalog.cities.find(c => c.id === route.originCityId)?.name ?? route.originCityId} به ${catalog.cities.find(c => c.id === route.destinationCityId)?.name ?? route.destinationCityId}`, onPress: () => onRoute(route.originCityId, route.destinationCityId) });
  return <RecoveryState label="بازیابی مقایسه سفر" title={title} description={description} tone={policy ? 'warning' : 'info'} busy={busy} actions={actions} illustration={offline || status === 'collecting' ? <ProviderDelayIllustration mode={query.mode} size="compact" /> : <EmptyRouteIllustration mode={query.mode} scope={query.scope} size="compact" />} />;
}
