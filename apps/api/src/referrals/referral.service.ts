import { ConfirmReferralInputSchema, ReferralSelectionSchema, type ConfirmReferralInput, type ReferralSelection, type RecheckResult } from '@torob-ticket/contracts';
import { ReferralRepository, RepositoryError, SearchRepository } from '@torob-ticket/data-access';
import { catalogForIdentity, mockFarePolicies } from '@torob-ticket/fixtures';
import { ProviderService } from '../providers/provider.service';
import type { SessionContext } from '../sessions/session-context';
import { SessionService } from '../sessions/session.service';
import { RecheckRegistry, type RecheckHandler } from './recheck-registry';
export class ReferralService {
    private readonly active = new Map<string, {
        controller: AbortController;
        done: Promise<void>;
    }>();
    private readonly pending = new Map<string, SessionContext>();
    private readonly unregister: () => void;
    constructor(private readonly sessions: SessionService, private readonly providers: ProviderService, private readonly registry = new RecheckRegistry()) {
        this.unregister = sessions.registerRecovery(() => this.recover());
        this.registry.register('transport', { prepareReferral: (session, selection) => this.prepareTransport(session, selection) });
    }
    registerRecheckHandler(kind:ReferralSelection['kind'],handler:RecheckHandler){this.registry.register(kind,handler);}
    get repository() {
        return new ReferralRepository(this.sessions.database, {
            revisions: { sourceRevisions: Object.fromEntries(Object.keys(mockFarePolicies).map(id => [id, 'source-v1'])), policyRevisions: Object.fromEntries(Object.entries(mockFarePolicies).map(([id, policy]) => [id, policy.revision])) },
            comparison: frozen => ({ places: catalogForIdentity(frozen.info.fixtureVersion, frozen.info.catalogRevision).places, policiesByProviderId: mockFarePolicies }),
        });
    }
    private async recover() {
        for (const [id, session] of this.pending) {
            try {
                await new SearchRepository(this.sessions.database).interrupt(session.scope, id, this.sessions.realClock.now());
            }
            catch (error) {
                if (!(error instanceof RepositoryError) || !['NOT_FOUND', 'SESSION_EXPIRED'].includes(error.code))
                    throw error;
            }
            this.pending.delete(id);
        }
    }
    async prepareReferral(session: SessionContext, request: ReferralSelection): Promise<RecheckResult> {
        const selection = ReferralSelectionSchema.parse(request);
        const handler = this.registry.get(selection.kind);
        return handler ? handler.prepareReferral(session, selection) : { status: 'unavailable', reason: 'OFFER_UNAVAILABLE', retryable: false, alternativeQuoteIds: [] };
    }
    private async prepareTransport(session: SessionContext, selection: ReferralSelection): Promise<RecheckResult> {
        if (selection.kind !== 'transport') throw new RepositoryError('INVALID_QUERY');
        await this.recover();
        const controller = new AbortController();
        let finish!: () => void;
        const done = new Promise<void>(resolve => { finish = resolve; });
        const release = this.sessions.registerController(session, controller, done);
        let id: string | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const admitted = await this.repository.admit(session.scope, selection, this.sessions.realClock);
            id = admitted.id;
            this.active.set(id, { controller, done });
            const deadline = new Date(this.sessions.realClock.now().getTime() + 5000);
            const context = await this.providers.createContext(session, id, controller.signal, deadline, admitted.operation.frozen);
            timer = setTimeout(() => controller.abort('deadline'), Math.max(0, deadline.getTime() - this.sessions.realClock.now().getTime()));
            const result = await this.registry.recheckTransport({ query: admitted.query, serviceKey: admitted.operation.previous.itinerary.itineraryId, previous: admitted.operation.previous }, context);
            if (controller.signal.aborted) {
                this.pending.set(id, session);
                await this.recover();
                return { status: 'unavailable', reason: 'OFFER_UNAVAILABLE', retryable: true, alternativeQuoteIds: [] };
            }
            return await this.repository.finish(session.scope, id, { providerId: result.providerId, status: result.status, outcome: result.outcome, offerId: result.record?.offer?.offerId, errorCode: result.errorCode }, this.sessions.realClock);
        }
        catch (error) {
            if (id) {
                this.pending.set(id, session);
                await this.recover().catch(() => undefined);
            }
            if (error instanceof RepositoryError && ['QUOTE_EXPIRED', 'QUOTE_CHANGED', 'OFFER_UNAVAILABLE', 'INCOMPLETE_PRICE'].includes(error.code))
                return { status: 'unavailable', reason: error.code, retryable: error.code === 'QUOTE_CHANGED', alternativeQuoteIds: [] };
            throw error;
        }
        finally {
            clearTimeout(timer);
            controller.abort();
            release();
            if (id)
                this.active.delete(id);
            finish();
        }
    }
    confirmReferral(session: SessionContext, input: ConfirmReferralInput) { return this.repository.confirm(session.scope, ConfirmReferralInputSchema.parse(input), this.sessions.realClock); }
    getReferral(session: SessionContext, id: string) { return this.repository.get(session.scope, id); }
    async onModuleDestroy() {
        this.unregister();
        for (const item of this.active.values())
            item.controller.abort('shutdown');
        await Promise.all([...this.active.values()].map(item => item.done));
    }
}
