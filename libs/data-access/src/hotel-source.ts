import { HotelRoomPolicySchema, RoomRateSchema, type RoomRate, type HotelRoomPolicy } from '@torob-ticket/contracts';
import { parseDate } from '@internationalized/date';
import { localDateAt } from '@torob-ticket/domain';
import { HOTEL_POLICY_REVISION } from '@torob-ticket/domain';
import { z } from 'zod';
const Template = RoomRateSchema.omit({ nightlyPrices: true }).extend({ nightlyTemplate: z.array(z.strictObject({ offset: z.number().int().min(0).max(119), amountRial: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), availableRooms: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })), policy: HotelRoomPolicySchema.omit({ revision: true }) }).strict();
/** Decodes the actual stored template; never substitutes module-global fixture data. */
export function materializeStoredHotelRate(raw: unknown, anchor: string, timeZone: string): {
    rate: RoomRate;
    policy: HotelRoomPolicy;
} {
    const parsed = Template.parse(raw);
    const { nightlyTemplate, policy, ...base } = parsed;
    const day = parseDate(localDateAt(anchor, timeZone));
    return { rate: RoomRateSchema.parse({ ...base, nightlyPrices: nightlyTemplate.map(n => ({ date: day.add({ days: n.offset }).toString(), total: { amountRial: n.amountRial, currency: 'IRR' }, availableRooms: n.availableRooms })) }), policy: { ...policy, revision: HOTEL_POLICY_REVISION } };
}
