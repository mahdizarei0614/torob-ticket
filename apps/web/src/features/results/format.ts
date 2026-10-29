import type { JourneyLeg, Place, QuoteSnapshot, TransportSearchQuery } from '@torob-ticket/contracts';
import {displayOperatorName,displayPlaceName} from '@torob-ticket/ui';
// A result list repeats the same locale/time-zone formats hundreds of times.
// Cache formatters, never formatted facts; invalid zones still throw normally.
const numberFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(timeZone: string, kind: 'time' | 'day') {
 const key = kind + ':' + timeZone;
 const existing = dateFormatters.get(key);
 if (existing) return existing;
 const formatter = new Intl.DateTimeFormat('fa-IR', kind === 'time'
  ? { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
  : { timeZone, day: 'numeric', month: 'long', year: 'numeric' });
 if (dateFormatters.size >= 128) dateFormatters.delete(dateFormatters.keys().next().value!);
 dateFormatters.set(key, formatter);
 return formatter;
}
export const number = (value: number) => numberFormatter.format(value);
export const toman = (amountRial: number) => `${numberFormatter.format(amountRial / 10)} تومان`;
export const minutes = (value: number) => `${value >= 60 ? `${number(Math.floor(value / 60))} ساعت` : ''}${value >= 60 && value % 60 ? ' و ' : ''}${value % 60 || value === 0 ? `${number(value % 60)} دقیقه` : ''}`;
export function localTime(instant: string, timeZone: string) { return dateFormatter(timeZone, 'time').format(new Date(instant)); }
export function localDay(instant: string, timeZone: string) { return dateFormatter(timeZone, 'day').format(new Date(instant)); }
export const travelerCount = (query: TransportSearchQuery) => query.party.adults + query.party.children + query.party.infants;
export const placeName = (places: Place[], id: string) => displayPlaceName(places.find(place => place.id === id));
export const routePlaces = (leg: JourneyLeg) => [leg.segments[0]!.originPlaceId, ...leg.segments.map(segment => segment.destinationPlaceId)];
export const selectionFor = (groupId: string, quote: QuoteSnapshot) => ({ groupId, quoteId: quote.quoteId, version: quote.version });
export const operatorLabel = (id: string, mode: TransportSearchQuery['mode']) => displayOperatorName(id,mode);
