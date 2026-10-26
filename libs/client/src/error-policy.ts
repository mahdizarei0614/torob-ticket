import type {ApiErrorCode} from '@torob-ticket/contracts';
import { ClientError } from './api-client';
export type RecoveryOperation = 'read' | 'mutation' | 'confirmation';
export type RecoveryKind = 'aborted' | 'expired' | 'missing' | 'capacity' | 'unsupported' | 'changed' | 'unavailable' | 'invalid' | 'network' | 'server';
export interface ErrorPolicy { kind: RecoveryKind; retryRead: boolean; requiresFreshQuote: boolean; title: { fa: string; en: string }; detail: { fa: string; en: string } }
/** A retryable API flag never authorizes repeating a mutation or an uncertain confirmation. */
export function errorPolicy(error: unknown, operation: RecoveryOperation = 'read'): ErrorPolicy {
  const value = error instanceof ClientError ? error : undefined;
  const code = value?.api?.code;
  const codes:Record<ApiErrorCode,RecoveryKind>={INVALID_QUERY:'invalid',UNSUPPORTED_ROUTE:'unsupported',AGE_REQUIRED:'invalid',SESSION_EXPIRED:'expired',NOT_FOUND:'missing',SEARCH_LIMIT:'capacity',QUOTE_EXPIRED:'unavailable',QUOTE_CHANGED:'changed',OFFER_UNAVAILABLE:'unavailable',INCOMPLETE_PRICE:'unavailable',INTENT_EXPIRED:'unavailable',IDEMPOTENCY_CONFLICT:'invalid',MAPPING_COLLISION:'changed',IDENTITY_REQUIRED:'invalid',SAVED_SEARCH_LIMIT:'capacity'};
  const aborted=!!error&&typeof error==='object'&&'name' in error&&error.name==='AbortError';
  const kind: RecoveryKind = aborted?'aborted':code?codes[code]:value?.kind==='request'?'invalid':value?.kind==='network'?'network':'server';
  const copy: Record<RecoveryKind, [string, string, string, string]> = {
    aborted: ['درخواست متوقف شد', 'Request stopped', 'اطلاعات واردشده حفظ شده است.', 'Your entered information is retained.'],
    expired: ['برای ادامه نشست را بازیابی کنید', 'Resume your session', 'فرم سفر و اقامت حفظ شده است؛ قیمت‌های قبلی برای ادامه معتبر نیستند.', 'Your edits are retained. Previous quotes need a fresh comparison.'],
    missing: ['شواهد این درخواست در دسترس نیست', 'Recorded evidence unavailable', 'ممکن است نشست بازنشانی شده باشد. سفر را نگه داشته‌ایم؛ برای قیمت تازه دوباره مقایسه کنید.', 'The session may have been reset. Keep your intent and create a fresh comparison.'],
    capacity: ['بررسی‌های قبلی هنوز فعال‌اند', 'Search capacity is busy', 'پس از پایان بررسی‌های فعال، همین شرایط را دوباره ارسال کنید؛ درخواست تازه خودکار ثبت نمی‌شود.', 'Wait for active work, then deliberately submit again. Nothing is resubmitted automatically.'],
    unsupported: ['این مسیر پشتیبانی نمی‌شود', 'Route unavailable', 'شرایط واردشده حفظ شده است؛ یک مسیر پشتیبانی‌شده را خودتان انتخاب کنید.', 'Your entered conditions remain. Choose a supported route explicitly.'],
    changed: ['شرایط مقایسه تغییر کرده است', 'Comparison settings changed', 'شواهد قبلی حفظ شده‌اند. پیش از انتخاب یا ادامه، مقایسه تازه بگیرید.', 'Historical evidence is retained. Refresh the comparison before selecting or continuing.'],
    unavailable: ['این پیشنهاد برای ادامه معتبر نیست', 'Quote no longer eligible', 'دریافت ناموفق به معنی نبود بلیت یا اتاق نیست؛ مقایسه تازه یا پیشنهاد دیگری را بررسی کنید.', 'A failed retrieval does not establish no availability. Compare again or inspect another offer.'],
    invalid: ['شرایط واردشده را بررسی کنید', 'Review the entered conditions', 'تاریخ، مسیر، سن و فیلترها را خودتان اصلاح کنید؛ هیچ‌کدام خودکار عوض نشده است.', 'Edit the date, route, ages or filters explicitly. They have not been silently changed.'],
    network: ['ارتباط برقرار نشد', 'Connection unavailable', 'اطلاعات دریافت‌شده و ویرایش‌های شما حفظ شده‌اند. اتصال را بررسی و دوباره تلاش کنید.', 'Received evidence and your edits are retained. Check the connection and try again.'],
    server: ['دریافت اطلاعات کامل نشد', 'Unable to retrieve the information', 'شواهد قبلی حفظ شده‌اند؛ خواندن وضعیت را دوباره امتحان کنید یا آگاهانه مقایسه تازه بگیرید.', 'Prior evidence is retained. Retry reading the status or deliberately create a new comparison.'],
  };
  const [fa, en, faDetail, enDetail] = copy[kind];
  return { kind, retryRead: operation === 'read' && (kind === 'network' || kind === 'server') && value?.kind !== 'schema', requiresFreshQuote: ['expired', 'missing', 'changed', 'unavailable'].includes(kind), title: { fa, en }, detail: { fa: faDetail, en: enDetail } };
}
