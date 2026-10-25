import type { JourneyLeg, Place, QuoteSnapshot, TransportSearchQuery } from '@torob-ticket/contracts';
export const number = (value: number) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value);
export const toman = (amountRial: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(amountRial / 10)} تومان`;
export const minutes = (value: number) => `${value >= 60 ? `${number(Math.floor(value / 60))} ساعت` : ''}${value >= 60 && value % 60 ? ' و ' : ''}${value % 60 || value === 0 ? `${number(value % 60)} دقیقه` : ''}`;
export function localTime(instant: string, timeZone: string) { return new Intl.DateTimeFormat('fa-IR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant)); }
export function localDay(instant: string, timeZone: string) { return new Intl.DateTimeFormat('fa-IR', { timeZone, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(instant)); }
export const travelerCount = (query: TransportSearchQuery) => query.party.adults + query.party.children + query.party.infants;
export const placeName = (places: Place[], id: string) => places.find(place => place.id === id)?.name ?? id;
export const routePlaces = (leg: JourneyLeg) => [leg.segments[0]!.originPlaceId, ...leg.segments.map(segment => segment.destinationPlaceId)];
export const selectionFor = (groupId: string, quote: QuoteSnapshot) => ({ groupId, quoteId: quote.quoteId, version: quote.version });
export const operatorLabel = (id: string, mode: TransportSearchQuery['mode']) => {
 const match = /^demo-operator-(flight|train|bus)-(\d+)$/.exec(id);
 return match ? `شرکت ${mode === 'flight' ? 'پرواز' : mode === 'train' ? 'ریلی' : 'اتوبوس'} نمونه ${number(Number(match[2]) + 1)} (خیالی)` : `مجری خیالی · ${id}`;
};
