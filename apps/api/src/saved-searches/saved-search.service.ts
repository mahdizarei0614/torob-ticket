import { Inject, Injectable } from '@nestjs/common';
import { AccountRepository } from '@torob-ticket/data-access';
import type { SaveSearchInput } from '@torob-ticket/contracts';
import { CatalogService } from '../catalog/catalog.service';
import { SessionService, sessionError } from '../sessions/session.service';
import type { SessionContext } from '../sessions/session-context';
@Injectable()
export class SavedSearchService {
    constructor(
    @Inject(SessionService)
    private readonly sessions: SessionService, 
    @Inject(CatalogService)
    private readonly catalog: CatalogService) { }
    private get repository() { return new AccountRepository(this.sessions.database); }
    list(context: SessionContext) { return this.repository.list(context.scope); }
    get(context: SessionContext, id: string) { return this.repository.get(context.scope, id); }
    delete(context: SessionContext, id: string) { return this.repository.delete(context.scope, id); }
    save(context: SessionContext, input: SaveSearchInput) { const c = this.catalog.get(context), q = input.query; const providers = c.providerCapabilities.filter(p => p.modes.includes(q.mode) && p.scopes.includes(q.scope) && p.classCodes.includes(q.classCode)); if (!c.supportedConnections.some(r => r.mode === q.mode && r.scope === q.scope && r.originCityId === q.originCityId && r.destinationCityId === q.destinationCityId) || !c.classChoices.some(r => r.mode === q.mode && r.code === q.classCode) || q.filters.providerIds?.some(id => !providers.some(p => p.providerId === id)) || q.mode !== 'flight' && q.filters.checkedBaggageMinKg !== undefined)
        throw sessionError('INVALID_QUERY', 400); return this.repository.save(context.scope, input, this.sessions.realClock.now()); }
}
