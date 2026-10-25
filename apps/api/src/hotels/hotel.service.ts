import { HotelSearchQuerySchema, type HotelSearchQuery } from '@torob-ticket/contracts';
import { localDateAt } from '@torob-ticket/domain';
import { parseDate } from '@internationalized/date';
import type { SessionContext } from '../sessions/session-context';
import { SessionService, sessionError } from '../sessions/session.service';
import { CatalogService } from '../catalog/catalog.service';
import { ReferralService } from '../referrals/referral.service';
import { HotelRecheck, HotelWorkOwner } from './hotel-recheck';
export class HotelService {
    private readonly owner: HotelWorkOwner;
    constructor(private readonly sessions: SessionService, private readonly catalog: CatalogService, referrals: ReferralService) {
        this.owner = new HotelWorkOwner(sessions);
        referrals.registerRecheckHandler('hotel', new HotelRecheck(sessions, catalog, this.owner));
    }
    searchHotels(session: SessionContext, input: HotelSearchQuery) {
        const query = HotelSearchQuerySchema.parse(input), catalog = this.catalog.get(session), city = catalog.cities.find(c => c.id === query.destinationCityId);
        if (!city)
            throw sessionError('INVALID_QUERY', 400);
        const arrival = query.arrivalPlaceId ? catalog.places.find(p => p.id === query.arrivalPlaceId && p.cityId === city.id && ['airport', 'station', 'terminal'].includes(p.kind)) : undefined;
        if (query.arrivalPlaceId && !arrival)
            throw sessionError('INVALID_QUERY', 400);
        const min = localDateAt(session.info.anchorInstant, city.timeZone), max = parseDate(min).add({ days: 120 }).toString();
        if (query.checkIn < min || query.checkOut > max)
            throw sessionError('INVALID_QUERY', 400);
        return this.owner.run(session, async (item) => {
            const now = this.sessions.realClock.now(), admitted = await this.owner.repository.admitSearch(session.scope, query, city.timeZone, now);
            item.id = admitted.id;
            this.owner.assertCurrent(item);
            const snapshot = this.owner.repository.buildSnapshot(admitted.id, admitted.run, city.timeZone, arrival?.point, now);
            this.owner.assertCurrent(item);
            return this.owner.repository.completeSearch(session.scope, admitted.id, snapshot, city.timeZone);
        });
    }
    get(session: SessionContext, id: string) {
        return this.owner.repository.get(session.scope, id);
    }
    onModuleDestroy() {
        return this.owner.destroy();
    }
}
