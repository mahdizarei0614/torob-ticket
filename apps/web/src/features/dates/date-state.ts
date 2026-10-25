import { parseDate, PersianCalendar, toCalendar, GregorianCalendar, startOfMonth, endOfMonth } from '@internationalized/date';
import { datePriceKey } from '@torob-ticket/client';
import type { DatePriceCell, DatePriceQuery, DatePriceSnapshot, SessionInfo } from '@torob-ticket/contracts';
import type { SearchDraft } from '../search/search-url';
export type DateLeg = DatePriceQuery['leg'];
export const settleMs = 250;
export function commitDate(query: SearchDraft, leg: DateLeg, date: string): SearchDraft {
  if (leg === 'return') return { ...query, returnDate: date };
  const next = { ...query, departureDate: date };
  if (next.returnDate && next.returnDate < date) delete next.returnDate;
  return next;
}
export function dateWindow(center: string, min: string, max: string, radius = 7): string[] {
  const first = parseDate(center).subtract({ days: Math.min(89, radius) });
  const dates: string[] = [];
  for (let i = 0; i <= Math.min(178, radius * 2); i++) { const date = first.add({ days: i }).toString(); if (date >= min && date <= max) dates.push(date); }
  return dates;
}
export function calendarWindow(date: string): string[] {
  const persian = toCalendar(parseDate(date), new PersianCalendar());
  const start = startOfMonth(persian); const end = endOfMonth(persian);
  return Array.from({ length: end.day }, (_, i) => toCalendar(start.add({ days: i }), new GregorianCalendar()).toString());
}
/** Public revision evidence only: hidden override values stay on the server. */
export function datePriceIdentityForSession(request: DatePriceQuery, session: SessionInfo): string {
  const { fixtureVersion, catalogRevision, seed, anchorInstant, scenario, mappingRevision, scenarioRevision } = session;
  return datePriceKey(request, { fixtureVersion, catalogRevision, seed, anchorInstant, scenario, mappingRevision, scenarioRevision });
}
export function matchesDateSnapshot(snapshot: DatePriceSnapshot, request: DatePriceQuery, session: SessionInfo, id?: string): boolean {
  if (snapshot.status !== 'checking' && snapshot.cells.some(cell => cell.status === 'checking')) return false;
  const expected = [...new Set(request.dates)].sort();
  const actual = snapshot.cells.map(cell => cell.date).sort();
  if (actual.length !== expected.length || actual.some((date, index) => date !== expected[index])) return false;
  return snapshot.clientGeneration === request.clientGeneration && snapshot.query.clientGeneration === request.clientGeneration && (!id || snapshot.datePriceId === id) && datePriceIdentityForSession(snapshot.query, session) === datePriceIdentityForSession(request, session);
}
export function snapshotFresh(snapshot: DatePriceSnapshot, now = Date.now()): boolean {
  const age = now - Date.parse(snapshot.observedAt);
  return snapshot.status === 'complete' && age >= 0 && age < 60000 && !snapshot.cells.some(cell => cell.status === 'unavailable' && cell.retryable);
}
export function dateLabel(date: string): string {
  let value; try { value = toCalendar(parseDate(date), new PersianCalendar()); } catch { return 'تاریخ انتخاب نشده'; }
  const number = (n: number) => new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(n);
  return `${number(value.year)}/${number(value.month)}/${number(value.day)}`;
}
export function cellLabel(cell?: DatePriceCell, leg: DateLeg = 'return'): string {
  if (!cell) return 'هنوز بررسی نشده';
  switch (cell.status) {
    case 'priced': return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(cell.minimum.amountRial / 10)} تومان`;
    case 'checking': return 'در حال بررسی';
    case 'no-match': return 'پیشنهاد مطابق نیست';
    case 'outside-coverage': return 'خارج از پوشش';
    case 'invalid-date-pair': return leg === 'outbound' ? 'برگشت را دوباره انتخاب کنید' : 'پیش از تاریخ رفت';
    case 'unavailable': return cell.reason === 'incomplete-price' ? 'قیمت کامل مشخص نیست' : 'قیمت در دسترس نیست';
  }
}
export function disabledCell(cell?: DatePriceCell, leg: DateLeg = 'return'): boolean { return cell?.status === 'outside-coverage' || (cell?.status === 'invalid-date-pair' && leg === 'return'); }
