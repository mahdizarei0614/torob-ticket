import { HotelRepository, RepositoryError } from '@torob-ticket/data-access';
import type { ReferralSelection, RecheckResult } from '@torob-ticket/contracts';
import type { SessionContext } from '../sessions/session-context';
import type { SessionService } from '../sessions/session.service';
import type { CatalogService } from '../catalog/catalog.service';
interface OwnedWork {
    id?: string;
    controller: AbortController;
    done: Promise<void>;
}
/** One cancellable owner for initial hotel searches and rechecks; no background resume fiction. */
export class HotelWorkOwner {
    private readonly active = new Set<OwnedWork>();
    private readonly pending = new Map<string, SessionContext>();
    private recovered = false;
    private destroyed = false;
    private readonly unregister: () => void;
    constructor(private readonly sessions: SessionService) {
        this.unregister = sessions.registerRecovery(() => this.recover());
    }
    get repository() {
        return new HotelRepository(this.sessions.database);
    }
    private async recover() {
        if (!this.recovered) {
            await this.repository.interruptUnfinished(this.sessions.realClock.now());
            this.recovered = true;
        }
        await this.recoverPending();
    }
    /** Failed owned jobs never trigger the global startup reconciliation. */
    private async recoverPending() {
        for (const [id, session] of this.pending) {
            try {
                await this.repository.fail(session.scope, id, 'interrupted', this.sessions.realClock.now());
                this.pending.delete(id);
            }
            catch (e) {
                if (e instanceof RepositoryError && ['SESSION_EXPIRED', 'NOT_FOUND'].includes(e.code))
                    this.pending.delete(id);
                else
                    throw e;
            }
        }
    }
    async run<T>(session: SessionContext, work: (owner: OwnedWork) => Promise<T>): Promise<T> {
        if (this.destroyed)
            throw new RepositoryError('SESSION_EXPIRED');
        let finish!: () => void;
        const item: OwnedWork = { controller: new AbortController(), done: new Promise<void>(resolve => {
                finish = resolve;
            }) };
        const release = this.sessions.registerController(session, item.controller, item.done);
        this.active.add(item);
        try {
            // Register before waiting so reset/shutdown can cancel this lease.
            if (!this.recovered)
                await this.sessions.ensureReady();
            this.assertCurrent(item);
            return await work(item);
        }
        catch (error) {
            if (item.id) {
                this.pending.set(item.id, session);
                try {
                    await this.recoverPending();
                }
                catch { /* Retained for the next readiness/recovery attempt. */
                }
            }
            throw error;
        }
        finally {
            item.controller.abort();
            release();
            this.active.delete(item);
            finish();
        }
    }
    assertCurrent(item: OwnedWork) {
        if (this.destroyed || item.controller.signal.aborted)
            throw new RepositoryError('SESSION_EXPIRED');
    }
    async destroy() {
        this.destroyed = true;
        this.unregister();
        for (const item of this.active)
            item.controller.abort();
        await Promise.all([...this.active].map(item => item.done));
    }
}
export class HotelRecheck {
    constructor(private readonly sessions: SessionService, private readonly catalog: CatalogService, private readonly owner: HotelWorkOwner) {
    }
    async prepareReferral(session: SessionContext, selection: ReferralSelection): Promise<RecheckResult> {
        try {
            const query = await this.owner.repository.queryForSelection(session.scope, selection, this.sessions.realClock);
            const city = this.catalog.get(session).cities.find(c => c.id === query.destinationCityId);
            if (!city)
                throw new RepositoryError('OFFER_UNAVAILABLE');
            return await this.owner.run(session, async (item) => {
                const admitted = await this.owner.repository.admitRecheck(session.scope, selection, city.timeZone, this.sessions.realClock);
                item.id = admitted.id;
                this.owner.assertCurrent(item);
                return this.owner.repository.finishRecheck(session.scope, admitted.id, city.timeZone, this.sessions.realClock);
            });
        }
        catch (error) {
            if (error instanceof RepositoryError && ['QUOTE_EXPIRED', 'QUOTE_CHANGED', 'OFFER_UNAVAILABLE', 'INCOMPLETE_PRICE'].includes(error.code))
                return { status: 'unavailable', reason: error.code, retryable: error.code === 'QUOTE_CHANGED', alternativeQuoteIds: [] };
            throw error;
        }
    }
}
