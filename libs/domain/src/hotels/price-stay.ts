import { HotelQuoteSnapshotSchema, type HotelSearchQuery, type RoomAllocation, type RoomRate } from '@torob-ticket/contracts';
import type { HotelPriceContext, HotelRoomPolicy, StayPriceResult, HotelTerms } from './types';
import { allocationEligibility, stayNights } from './rate-authority';
function aggregate(values: RoomRate['infantCountsTowardOccupancy'][]): RoomRate['infantCountsTowardOccupancy'] {
    if (values.some(v => v.status === 'known' && !v.value))
        return { status: 'known', value: false };
    if (values.every(v => v.status === 'known' && v.value))
        return { status: 'known', value: true };
    return { status: 'unknown', reason: 'mixed-or-unknown-room-terms' };
}
export function priceStay(query: HotelSearchQuery, allocation: RoomAllocation[], rates: readonly RoomRate[], policies: Record<string, HotelRoomPolicy>, context: HotelPriceContext): StayPriceResult {
    const checked = allocationEligibility(query, allocation, rates, policies);
    if (checked.status !== 'eligible')
        return { status: checked.status, reasons: checked.reasons };
    const nights = stayNights(query), selected = allocation.map(room => rates.find(rate => rate.roomRateId === room.roomRateId)!);
    let total = 0n;
    const breakdown = allocation.map((room, index) => {
        const rate = selected[index]!;
        const amount = nights.reduce((sum, date) => sum + BigInt(rate.nightlyPrices.find(n => n.date === date)!.total.amountRial), 0n);
        total += amount;
        if (amount > BigInt(Number.MAX_SAFE_INTEGER))
            throw new RangeError('Hotel room stay exceeds safe rial range');
        return { code: 'room-' + room.roomNumber + '-all-nights', amount: { amountRial: Number(amount), currency: 'IRR' as const }, mandatory: true };
    });
    if (total > BigInt(Number.MAX_SAFE_INTEGER))
        throw new RangeError('Hotel stay exceeds safe rial range');
    const missing = [...new Set(selected.flatMap(rate => rate.terms.fees.status === 'incomplete' ? rate.terms.fees.missing : []))].sort();
    if (missing.length)
        return { status: 'incomplete', reasons: missing, knownSubtotal: { amountRial: Number(total), currency: 'IRR' } };
    const terms = selected.map(rate => rate.terms), cancellation = terms[0]!.cancellation;
    const combined: HotelTerms = { breakfast: aggregate(terms.map(t => t.breakfast)), refundable: aggregate(terms.map(t => t.refundable)), cancellation: terms.every(t => JSON.stringify(t.cancellation) === JSON.stringify(cancellation)) ? cancellation : { status: 'unknown', reason: 'mixed-room-cancellation-terms' }, fees: { status: 'complete' }, materialTerms: [...new Set(terms.flatMap(t => t.materialTerms))].sort() };
    const observed = Date.parse(context.observedAt);
    const provenance = [...new Map(selected.flatMap(rate => rate.provenance).map(item => [JSON.stringify(item), item])).values()];
    const quote = HotelQuoteSnapshotSchema.parse({ quoteId: context.quoteId, version: context.version ?? 1, hotelId: selected[0]!.hotelId, providerId: selected[0]!.providerId, query, roomAllocation: allocation, roomDetails: allocation.map((room, index) => {
            const rate = selected[index]!;
            return { roomNumber: room.roomNumber, roomRateId: room.roomRateId, roomType: rate.roomType, maxAdults: rate.maxAdults, maxChildren: rate.maxChildren, maxInfants: rate.maxInfants, infantCountsTowardOccupancy: rate.infantCountsTowardOccupancy, terms: rate.terms, policy: policies[rate.roomRateId], provenance: rate.provenance };
        }), total: { amountRial: Number(total), currency: 'IRR' }, breakdown, completeness: { status: 'complete' }, eligibility: { status: 'eligible' }, terms: combined, observedAt: new Date(observed).toISOString(), expiresAt: new Date(observed + 600000).toISOString(), sourceRevision: context.sourceRevision, mappingRevision: context.mappingRevision, fixtureVersion: context.fixtureVersion, provenance });
    return { status: 'priced', quote };
}
