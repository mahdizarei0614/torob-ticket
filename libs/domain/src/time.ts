import { CalendarDate, GregorianCalendar, PersianCalendar, fromAbsolute, toCalendar, toCalendarDate } from '@internationalized/date';
import { ISOInstantSchema, LocalDateSchema, TimeZoneSchema, type EligibilityFilters, type ISOInstant, type LocalDate } from '@torob-ticket/contracts';

export type DepartureWindow = NonNullable<EligibilityFilters['departureWindow']>;

/** Converts a calendar date directly, never through an instant or host time zone. */
export function toGregorianDate(value: string, calendar: 'persian' | 'gregory'): LocalDate {
  if (calendar !== 'persian' && calendar !== 'gregory') throw new RangeError('Unsupported calendar');
  const digits = value.replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(digits)) throw new RangeError('Date-only YYYY-MM-DD required');
  const [year = 0, month = 0, day = 0] = digits.split('-').map(Number);
  if (year < 1) throw new RangeError('Positive calendar year required');
  const source = new CalendarDate(calendar === 'persian' ? new PersianCalendar() : new GregorianCalendar(), year, month, day);
  // CalendarDate constrains invalid fields; reject rather than silently changing the day.
  if (source.year !== year || source.month !== month || source.day !== day) throw new RangeError('Invalid calendar date');
  return LocalDateSchema.parse(toCalendar(source, new GregorianCalendar()).toString());
}

export function elapsedMinutes(departure: ISOInstant, arrival: ISOInstant): number {
  const duration = Date.parse(ISOInstantSchema.parse(arrival)) - Date.parse(ISOInstantSchema.parse(departure));
  if (duration < 0) throw new RangeError('Arrival precedes departure');
  return duration / 60000;
}

function zonedInstant(instant: ISOInstant, timeZone: string) {
  return fromAbsolute(Date.parse(ISOInstantSchema.parse(instant)), TimeZoneSchema.parse(timeZone));
}

/** Arrival/check-in dates must use the destination zone, not UTC string truncation. */
export function localDateAt(instant: ISOInstant, timeZone: string): LocalDate {
  return LocalDateSchema.parse(toCalendarDate(zonedInstant(instant, timeZone)).toString());
}

/** Inclusive minute boundaries; equal endpoints mean one minute, not all day. */
export function matchesDepartureWindow(instant: ISOInstant, timeZone: string, window: DepartureWindow): boolean {
  if (![window.startMinute, window.endMinute].every(minute => Number.isInteger(minute) && minute >= 0 && minute < 1440)) {
    throw new RangeError('Departure window must use minutes 0 through 1439');
  }
  const local = zonedInstant(instant, timeZone);
  const minute = local.hour * 60 + local.minute;
  return window.startMinute <= window.endMinute
    ? minute >= window.startMinute && minute <= window.endMinute
    : minute >= window.startMinute || minute <= window.endMinute;
}
