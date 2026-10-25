import { HotelSearchQuerySchema, type HotelSearchQuery, type RoomRate, type RoomAllocation } from '@torob-ticket/contracts';
import type { AllocationEvaluation, HotelRoomPolicy } from './types';
import { prepareRate, roomEligibility, stayNights } from './rate-authority';
function subsets(values: number[], count: number): {
    chosen: number[];
    rest: number[];
}[] {
    const out: {
        chosen: number[];
        rest: number[];
    }[] = [];
    function visit(start: number, indices: number[]) {
        if (indices.length === count) {
            const chosen = new Set(indices);
            out.push({ chosen: indices.map(i => values[i]!), rest: values.filter((_, i) => !chosen.has(i)) });
            return;
        }
        for (let i = start; i <= values.length - (count - indices.length); i++) {
            if (i > start && values[i] === values[i - 1])
                continue;
            visit(i + 1, [...indices, i]);
        }
    }
    visit(0, []);
    return out;
}
/** Canonical rate/occupancy ordering removes room permutations without dropping a feasible cost. */
export function allocateRooms(query: HotelSearchQuery, rates: readonly RoomRate[], policies: Record<string, HotelRoomPolicy>): AllocationEvaluation {
    HotelSearchQuerySchema.parse(query);
    const nights = stayNights(query), all: RoomAllocation[][] = [], unknown = new Set<string>(), failures = new Set<string>();
    let unknownAllocation = false, ambiguousSource = false;
    const groups = new Map<string, RoomRate[]>();
    for (const rate of rates) {
        const key = rate.hotelId + '|' + rate.providerId;
        const group = groups.get(key) ?? [];
        group.push(rate);
        groups.set(key, group);
    }
    for (const group of groups.values()) {
        const usable = group.filter(rate => {
            if (group.filter(x => x.roomRateId === rate.roomRateId).length !== 1) {
                unknown.add('ambiguous-room-rate');
                ambiguousSource = true;
                return false;
            }
            const p = prepareRate(rate, policies[rate.roomRateId], nights);
            if (p.status === 'unknown')
                p.reasons.forEach(r => unknown.add(r));
            if (p.status === 'ineligible')
                p.reasons.forEach(r => failures.add(r));
            if (p.status === 'unknown' && !p.available)
                ambiguousSource = true;
            return p.available > 0;
        }).sort((a, b) => a.roomRateId.localeCompare(b.roomRateId, 'en'));
        const inventory = new Map(usable.map(rate => [rate.roomRateId, prepareRate(rate, policies[rate.roomRateId], nights).available]));
        function visit(rooms: RoomAllocation[], adults: number, children: number, infants: number, childAges: number[] | undefined, infantAges: number[] | undefined, last: string, uncertain = false) {
            const remaining = query.rooms - rooms.length;
            if (!remaining) {
                if (!adults && !children && !infants) {
                    if (uncertain)
                        unknownAllocation = true;
                    else
                        all.push(rooms);
                }
                return;
            }
            if (adults < remaining)
                return;
            for (const rate of usable) {
                if (rooms.filter(room => room.roomRateId === rate.roomRateId).length >= inventory.get(rate.roomRateId)!)
                    continue;
                for (let a = 1; a <= Math.min(rate.maxAdults, adults - remaining + 1); a++)
                    for (let c = 0; c <= Math.min(rate.maxChildren, children); c++)
                        for (let i = 0; i <= Math.min(rate.maxInfants, infants); i++) {
                            const choices = childAges ? subsets(childAges, c) : [{ chosen: undefined, rest: undefined }];
                            for (const choice of choices) {
                                const room: RoomAllocation = { roomNumber: rooms.length + 1, roomRateId: rate.roomRateId, adults: a, children: c, infants: i, ...(choice.chosen ? { childAgesAtCheckIn: choice.chosen } : {}), ...(infantAges ? { infantAgesMonths: infantAges.slice(0, i) } : {}) };
                                const signature = JSON.stringify([room.roomRateId, a, c, i, room.childAgesAtCheckIn ?? []]);
                                if (signature < last)
                                    continue;
                                const check = roomEligibility(room, rate, policies[rate.roomRateId]!);
                                if (check.status !== 'eligible')
                                    check.reasons.forEach(r => (check.status === 'unknown' ? unknown : failures).add(r));
                                if (check.status === 'ineligible')
                                    continue;
                                visit([...rooms, room], adults - a, children - c, infants - i, choice.rest, infantAges?.slice(i), signature, uncertain || check.status === 'unknown');
                            }
                        }
            }
        }
        visit([], query.party.adults, query.party.children, query.party.infants, query.childAgesAtCheckIn?.slice().sort((a, b) => a - b), query.party.infantAgesMonths?.slice().sort((a, b) => a - b), '');
    }
    // Equal rate multisets have equal room-night price and terms. Keep the canonical valid partition.
    const unique = new Map<string, RoomAllocation[]>();
    for (const allocation of all) {
        const key = allocation.map(room => room.roomRateId).sort().join('|');
        if (!unique.has(key))
            unique.set(key, allocation);
    }
    const allocations = [...unique.values()];
    return { status: allocations.length ? 'eligible' : unknownAllocation || ambiguousSource ? 'unknown' : 'ineligible', allocations, reasons: allocations.length ? [] : [...new Set([...unknown, ...failures, ...(!unknown.size ? ['no-eligible-allocation'] : [])])].sort() };
}
