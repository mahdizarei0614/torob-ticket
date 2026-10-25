import { HotelRoomPolicySchema, HotelSearchQuerySchema, RoomAllocationSchema, RoomRateSchema, type HotelSearchQuery, type RoomAllocation, type RoomRate, type HotelRoomPolicy, } from '@torob-ticket/contracts';
import { parseDate } from '@internationalized/date';
export function stayNights(query: Pick<HotelSearchQuery, 'checkIn' | 'checkOut'>): string[] {
    const start = parseDate(query.checkIn), end = parseDate(query.checkOut), count = end.compare(start);
    if (count <= 0 || count > 120)
        throw new RangeError('Hotel stay must have 1..120 nights');
    return Array.from({ length: count }, (_, i) => start.add({ days: i }).toString());
}
export function prepareRate(rate: RoomRate, policy: HotelRoomPolicy | undefined, nights: readonly string[]) {
    if (!RoomRateSchema.safeParse(rate).success)
        return { status: 'unknown' as const, reasons: ['invalid-rate-source'], available: 0 };
    const selected = nights.map(date => rate.nightlyPrices.filter(n => n.date === date));
    if (selected.some(entries => entries.length > 1))
        return { status: 'unknown' as const, reasons: ['duplicate-night-source'], available: 0 };
    if (selected.some(entries => entries.length === 0))
        return { status: 'ineligible' as const, reasons: ['missing-night-inventory'], available: 0 };
    const available = Math.min(...selected.map(entries => entries[0]!.availableRooms));
    if (!available)
        return { status: 'ineligible' as const, reasons: ['night-unavailable'], available };
    if (!HotelRoomPolicySchema.safeParse(policy).success)
        return { status: 'unknown' as const, reasons: ['missing-room-policy'], available };
    return { status: 'eligible' as const, reasons: [], available };
}
/** Definite published numeric failures take precedence over missing policy information. */
export function roomEligibility(room: RoomAllocation, rate: RoomRate, policy: HotelRoomPolicy | undefined) {
    if (!RoomAllocationSchema.safeParse(room).success || room.adults > rate.maxAdults || room.children > rate.maxChildren || room.infants > rate.maxInfants)
        return { status: 'ineligible' as const, reasons: ['room-capacity-exceeded'] };
    if (!HotelRoomPolicySchema.safeParse(policy).success)
        return { status: 'unknown' as const, reasons: ['missing-room-policy'] };
    if (room.childAgesAtCheckIn?.some(age => age > policy!.maxChildAge))
        return { status: 'ineligible' as const, reasons: ['child-age-outside-room-policy'] };
    // Even unknown infant semantics cannot hide a known adults/children combined-limit violation.
    if (policy!.maxOccupants !== undefined && room.adults + room.children > policy!.maxOccupants)
        return { status: 'ineligible' as const, reasons: ['combined-occupancy-exceeded'] };
    if (room.children && policy!.childAgeRequired && !room.childAgesAtCheckIn)
        return { status: 'unknown' as const, reasons: ['stay-child-ages-required'] };
    if (room.infants) {
        if (rate.infantCountsTowardOccupancy.status === 'unknown')
            return { status: 'unknown' as const, reasons: ['infant-occupancy-unknown'] };
        if (rate.infantCountsTowardOccupancy.value && policy!.maxOccupants === undefined)
            return { status: 'unknown' as const, reasons: ['combined-occupancy-limit-unknown'] };
    }
    if (policy!.maxOccupants !== undefined) {
        const infants = rate.infantCountsTowardOccupancy.status === 'known' && !rate.infantCountsTowardOccupancy.value ? 0 : room.infants;
        if (room.adults + room.children + infants > policy!.maxOccupants)
            return { status: 'ineligible' as const, reasons: ['combined-occupancy-exceeded'] };
    }
    return { status: 'eligible' as const, reasons: [] };
}
export function allocationEligibility(query: HotelSearchQuery, allocation: RoomAllocation[], rates: readonly RoomRate[], policies: Record<string, HotelRoomPolicy>) {
    HotelSearchQuerySchema.parse(query);
    const nights = stayNights(query), reasons: string[] = [];
    let unknown = false, ineligible = false;
    if (allocation.some(room => !RoomAllocationSchema.safeParse(room).success))
        return { status: 'ineligible' as const, reasons: ['invalid-room-allocation'] };
    if (allocation.length !== query.rooms || new Set(allocation.map(r => r.roomNumber)).size !== query.rooms || allocation.some(r => r.roomNumber > query.rooms))
        return { status: 'ineligible' as const, reasons: ['exact-room-count-required'] };
    for (const key of ['adults', 'children', 'infants'] as const)
        if (allocation.reduce((sum, r) => sum + r[key], 0) !== query.party[key])
            return { status: 'ineligible' as const, reasons: ['allocation-party-mismatch'] };
    const sorted = (values: number[]) => values.slice().sort((a, b) => a - b).join(',');
    if (query.childAgesAtCheckIn && sorted(allocation.flatMap(r => r.childAgesAtCheckIn ?? [])) !== sorted(query.childAgesAtCheckIn))
        return { status: 'ineligible' as const, reasons: ['stay-age-allocation-mismatch'] };
    if (query.party.infantAgesMonths && sorted(allocation.flatMap(r => r.infantAgesMonths ?? [])) !== sorted(query.party.infantAgesMonths))
        return { status: 'ineligible' as const, reasons: ['infant-age-allocation-mismatch'] };
    const selected = allocation.map(room => rates.filter(rate => rate.roomRateId === room.roomRateId));
    if (selected.some(items => items.length !== 1))
        return { status: 'unknown' as const, reasons: ['ambiguous-room-rate'] };
    if (new Set(selected.map(items => items[0]!.hotelId)).size !== 1 || new Set(selected.map(items => items[0]!.providerId)).size !== 1)
        return { status: 'ineligible' as const, reasons: ['mixed-hotel-or-provider'] };
    for (const [index, room] of allocation.entries()) {
        const rate = selected[index]![0]!, policy = policies[room.roomRateId], source = prepareRate(rate, policy, nights);
        const record = (result: {
            status: string;
            reasons: string[];
        }) => {
            unknown ||= result.status === 'unknown';
            ineligible ||= result.status === 'ineligible';
            reasons.push(...result.reasons);
        };
        record(source);
        if (source.available && allocation.filter(r => r.roomRateId === room.roomRateId).length > source.available)
            record({ status: 'ineligible', reasons: ['night-room-inventory-exceeded'] });
        record(roomEligibility(room, rate, policy));
        if (room.children && policy?.childAgeRequired && !query.childAgesAtCheckIn)
            record({ status: 'unknown', reasons: ['stay-child-ages-required'] });
    }
    return reasons.length ? { status: ineligible ? 'ineligible' as const : unknown ? 'unknown' as const : 'ineligible' as const, reasons: [...new Set(reasons)].sort() } : { status: 'eligible' as const, reasons: [] };
}
