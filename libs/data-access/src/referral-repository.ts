import {HotelRepository} from './hotel-repository';
import {assertSearchAdmission} from './admission';
import { createHash, randomUUID } from 'node:crypto';
import { ItinerarySchema, NormalizedOfferSchema, QuoteSnapshotSchema, ReferralIntentSchema, ReferralReceiptSchema, SearchSnapshotSchema, TransportSearchQuerySchema, type ConfirmReferralInput, type Itinerary, type NormalizedOffer, type QuoteSnapshot, type ReferralIntent, type ReferralSelection, type RecheckResult } from '@torob-ticket/contracts';
import { canonicalValue, itineraryKey, quoteOffer, type ComparisonContext, type RealClock, type SourceFareEvidence } from '@torob-ticket/domain';
import type { Prisma, PrismaClient } from './generated/client';
import { RepositoryError, scopedTransaction, type DataScope } from './scope';
import { readProviderContext, type ProviderContextSnapshot } from './search-repository';
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
const digest = (value: unknown) => createHash('sha256').update(canonicalValue(value)).digest('hex');
export interface ReferralEnvironment {
    revisions: {
        sourceRevisions: Record<string, string>;
        policyRevisions: Record<string, string>;
    } | ((snapshot: ProviderContextSnapshot) => { sourceRevisions: Record<string, string>; policyRevisions: Record<string, string> });
    comparison(snapshot: ProviderContextSnapshot): Pick<ComparisonContext, 'places' | 'policiesByProviderId'>;
}
export interface RecheckOperation {
    kind: 'referral-recheck';
    originSearchId: string;
    selection: ReferralSelection;
    frozen: ProviderContextSnapshot;
    fingerprint: string;
    previous: NormalizedOffer;
    previousQuote: QuoteSnapshot;
    /** Frozen public display lineage; absent on already-stored legacy operations. */
    publicItinerary?: Itinerary;
}
export interface RecheckCompletion {
    providerId: string;
    status: string;
    outcome: string;
    offerId?: string;
    errorCode?: string;
}
interface StoredIntent {
    intent: ReferralIntent;
    fingerprint: string;
    digest: string;
}
/** Server-only authority: quote lineage, recheck commit and confirmation share the session lock. */
export class ReferralRepository {
    constructor(private readonly db: PrismaClient, private readonly environment?: ReferralEnvironment) { }
    private fingerprint(frozen: ProviderContextSnapshot) {
        const i = frozen.info;
        const revisions=typeof this.environment?.revisions==='function'?this.environment.revisions(frozen):this.environment?.revisions;
        return digest({ fixtureVersion: i.fixtureVersion, catalogRevision: i.catalogRevision, seed: i.seed, anchorInstant: i.anchorInstant, scenario: i.scenario, scenarioRevision: i.scenarioRevision, mappingRevision: i.mappingRevision, mappings: frozen.mappings, overrides: Object.fromEntries(frozen.overrides.map(row => [row.providerId, row.payload])), revisions });
    }
    private async current(tx: Prisma.TransactionClient, scope: DataScope) {
        const session = await tx.demoSession.findUniqueOrThrow({ where: { id: scope.sessionId } });
        return readProviderContext(tx, scope, session);
    }
    private complete(value: unknown) {
        const parsed = QuoteSnapshotSchema.safeParse(value);
        if (!parsed.success || parsed.data.completeness.status !== 'complete')
            throw new RepositoryError('INCOMPLETE_PRICE');
        if (parsed.data.eligibility.status !== 'eligible')
            throw new RepositoryError('OFFER_UNAVAILABLE');
        return parsed.data;
    }
    private evaluate(payload: Prisma.JsonValue, query: unknown, frozen: ProviderContextSnapshot, now: Date) {
        const evidence = payload as unknown as {
            offer: unknown;
            source?: SourceFareEvidence;
        };
        const offer = NormalizedOfferSchema.parse(evidence.offer);
        if (!this.environment || !evidence.source)
            throw new RepositoryError('OFFER_UNAVAILABLE');
        const evaluation = quoteOffer(offer, TransportSearchQuerySchema.parse(query), { ...this.environment.comparison(frozen), realClock: { now: () => now }, sourceByOfferId: { [offer.offerId]: { rawRecordId: offer.provenance[0]!.rawRecordId, source: evidence.source } } });
        if (evaluation.status !== 'eligible')
            throw new RepositoryError(evaluation.status === 'incomplete' ? 'INCOMPLETE_PRICE' : 'OFFER_UNAVAILABLE');
        return { offer, quote: evaluation.quote };
    }
    private checkedPublicItinerary(value: unknown, expectedId: string) {
        const parsed = ItinerarySchema.safeParse(value);
        if (!parsed.success || parsed.data.itineraryId !== expectedId || itineraryKey(parsed.data) !== expectedId)
            throw new RepositoryError('QUOTE_CHANGED');
        return parsed.data;
    }
    private async selected(tx: Prisma.TransactionClient, scope: DataScope, selection: ReferralSelection, now: Date) {
        if (selection.kind !== 'transport')
            throw new RepositoryError('OFFER_UNAVAILABLE');
        const row = await tx.quote.findUnique({ where: { sessionId_id_version: { sessionId: scope.sessionId, id: selection.quoteId, version: selection.quoteVersion } }, include: { offer: true } });
        if (!row || !row.offer)
            throw new RepositoryError('NOT_FOUND');
        if (row.expiresAt <= now)
            throw new RepositoryError('QUOTE_EXPIRED');
        const quote = this.complete(row.payload);
        const latest = await tx.quote.findFirst({ where: { sessionId: scope.sessionId, id: selection.quoteId }, orderBy: { version: 'desc' } });
        if (latest?.version !== selection.quoteVersion)
            throw new RepositoryError('QUOTE_CHANGED');
        const original = await tx.quote.findUnique({ where: { sessionId_id_version: { sessionId: scope.sessionId, id: selection.quoteId, version: 1 } }, include: { offer: true } });
        if (!original?.offer)
            throw new RepositoryError('NOT_FOUND');
        const originSearchId = original.offer.searchId;
        if (await tx.datePriceRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: originSearchId } } }))
            throw new RepositoryError('NOT_FOUND');
        const origin = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: originSearchId } } });
        const snapshot = SearchSnapshotSchema.safeParse(origin?.snapshot);
        const group = snapshot.success ? snapshot.data.groups.find(candidate => candidate.eligibleQuotes.some(q => q.quoteId === selection.quoteId && canonicalValue(q) === canonicalValue(original.payload))) : undefined;
        if (!origin || !group)
            throw new RepositoryError('NOT_FOUND');
        // Public comparison identity may retain another seller's local segment IDs.
        if (group.groupId !== quote.itineraryId)
            throw new RepositoryError('QUOTE_CHANGED');
        let itinerary = this.checkedPublicItinerary(group.itinerary, quote.itineraryId);
        if (row.version > 1) {
            const parent = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: row.offer.searchId } } });
            const operation = parent?.snapshot as unknown as RecheckOperation;
            if (operation?.kind !== 'referral-recheck' || operation.originSearchId !== originSearchId || operation.selection.quoteId !== selection.quoteId || operation.selection.quoteVersion !== row.version - 1)
                throw new RepositoryError('NOT_FOUND');
            if (operation.publicItinerary !== undefined)
                itinerary = this.checkedPublicItinerary(operation.publicItinerary, quote.itineraryId);
        }
        return { row, quote, query: TransportSearchQuerySchema.parse(origin.query), originSearchId, itinerary };
    }
    admit(scope: DataScope, selection: ReferralSelection, clock: RealClock) {
        return scopedTransaction(this.db, scope, async (tx) => {
            const now = clock.now();
            const selected = await this.selected(tx, scope, selection, now);
            const frozen = await this.current(tx, scope);
            const checked = this.evaluate(selected.row.offer!.payload, selected.query, frozen, new Date(selected.quote.observedAt));
            if (canonicalValue({ ...checked.quote, quoteId: selected.quote.quoteId, version: selected.quote.version }) !== canonicalValue(selected.quote))
                throw new RepositoryError('QUOTE_CHANGED');
            await assertSearchAdmission(tx,scope);
            const id = randomUUID();
            const operation: RecheckOperation = { kind: 'referral-recheck', originSearchId: selected.originSearchId, selection, frozen, fingerprint: this.fingerprint(frozen), previous: checked.offer, previousQuote: selected.quote, publicItinerary: selected.itinerary };
            await tx.searchRun.create({ data: { sessionId: scope.sessionId, id, query: json(selected.query), clientGeneration: id, status: 'collecting', snapshot: json(operation), mappingRevision: frozen.info.mappingRevision, fixtureVersion: frozen.info.fixtureVersion, createdAt: now, updatedAt: now } });
            await this.audit(tx, scope, 'referral-recheck-started', { searchId: id, ...operation }, now);
            return { id, operation, query: selected.query };
        });
    }
    finish(scope: DataScope, id: string, evidence: RecheckCompletion, clock: RealClock): Promise<RecheckResult> {
        return scopedTransaction(this.db, scope, async (tx) => {
            const now = clock.now();
            const run = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
            const operation = run?.snapshot as unknown as RecheckOperation;
            if (!run || operation.kind !== 'referral-recheck' || run.status !== 'collecting')
                throw new RepositoryError('NOT_FOUND');
            const frozen = await this.current(tx, scope);
            if (this.fingerprint(frozen) !== operation.fingerprint)
                throw new RepositoryError('QUOTE_CHANGED');
            const selected = await this.selected(tx, scope, operation.selection, now);
            const publicItinerary = operation.publicItinerary === undefined ? selected.itinerary : this.checkedPublicItinerary(operation.publicItinerary, selected.quote.itineraryId);
            if (evidence.providerId !== operation.previous.providerId)
                throw new RepositoryError('OFFER_UNAVAILABLE');
            await tx.providerRun.upsert({ where: { sessionId_searchId_providerId: { sessionId: scope.sessionId, searchId: id, providerId: evidence.providerId } }, create: { sessionId: scope.sessionId, searchId: id, id: randomUUID(), providerId: evidence.providerId, status: evidence.status, payload: json(evidence) }, update: { status: evidence.status, payload: json(evidence) } });
            let result: RecheckResult;
            const row = evidence.status === 'success' && evidence.offerId ? await tx.offerSnapshot.findFirst({ where: { sessionId: scope.sessionId, id: evidence.offerId, searchId: id } }) : null;
            if (!row)
                result = { status: 'unavailable', reason: 'OFFER_UNAVAILABLE', retryable: true, alternativeQuoteIds: [] };
            else {
                try {
                    const fresh = this.evaluate(row.payload, selected.query, frozen, now);
                    // The selected fare/service is immutable; a new journey is not acceptance of this selection.
                    if (fresh.offer.providerId !== operation.previous.providerId || fresh.offer.fareId !== operation.previous.fareId || canonicalValue(fresh.offer.itinerary) !== canonicalValue(operation.previous.itinerary) || fresh.quote.itineraryId !== selected.quote.itineraryId)
                        throw new RepositoryError('OFFER_UNAVAILABLE');
                    const quote = { ...fresh.quote, quoteId: selected.quote.quoteId, version: selected.quote.version + 1 };
                    await tx.quote.create({ data: { sessionId: scope.sessionId, id: quote.quoteId, version: quote.version, offerId: row.id, payload: json(quote), observedAt: now, expiresAt: new Date(quote.expiresAt) } });
                    const intent = ReferralIntentSchema.parse({ intentId: randomUUID(), selection: { kind: 'transport', quoteId: quote.quoteId, quoteVersion: quote.version }, quote: { kind: 'transport', quote, itinerary: publicItinerary }, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 120000).toISOString() });
                    const payload: StoredIntent = { intent, fingerprint: operation.fingerprint, digest: digest(intent) };
                    await tx.referralIntent.create({ data: { sessionId: scope.sessionId, id: intent.intentId, quoteId: quote.quoteId, quoteVersion: quote.version, payload: json(payload), createdAt: now, expiresAt: new Date(intent.expiresAt) } });
                    const materialChanges = (['total', 'breakdown', 'conditions'] as const).filter(key => canonicalValue(selected.quote[key]) !== canonicalValue(quote[key]));
                    result = materialChanges.length ? { status: 'changed', intent, previousQuoteVersion: selected.quote.version, previousQuote: { kind: 'transport', quote: selected.quote, itinerary: publicItinerary }, materialChanges } : { status: 'ready', intent };
                }
                catch (error) {
                    if (!(error instanceof RepositoryError) || !['OFFER_UNAVAILABLE', 'INCOMPLETE_PRICE'].includes(error.code))
                        throw error;
                    result = { status: 'unavailable', reason: error.code, retryable: false, alternativeQuoteIds: [] };
                }
            }
            if (result.status === 'unavailable')
                result.alternativeQuoteIds = await this.alternatives(tx, scope, operation, now);
            await tx.searchRun.update({ where: { sessionId_id: { sessionId: scope.sessionId, id } }, data: { status: 'complete', updatedAt: now } });
            await this.audit(tx, scope, 'referral-rechecked', { searchId: id, evidence, result }, now);
            return result;
        });
    }
    private async alternatives(tx: Prisma.TransactionClient, scope: DataScope, operation: RecheckOperation, now: Date) {
        const original = await tx.searchRun.findUniqueOrThrow({ where: { sessionId_id: { sessionId: scope.sessionId, id: operation.originSearchId } } });
        const snapshot = SearchSnapshotSchema.parse(original.snapshot);
        const alternatives: string[] = [];
        for (const quote of snapshot.groups.flatMap(group => group.eligibleQuotes)) {
            if (quote.quoteId === operation.selection.quoteId)
                continue;
            try {
                const candidate = await this.selected(tx, scope, { kind: 'transport', quoteId: quote.quoteId, quoteVersion: quote.version }, now);
                if (candidate.originSearchId !== operation.originSearchId)
                    continue;
                this.evaluate(candidate.row.offer!.payload, candidate.query, operation.frozen, new Date(candidate.quote.observedAt));
                alternatives.push(quote.quoteId);
            }
            catch (error) {
                if (!(error instanceof RepositoryError))
                    throw error;
            }
        }
        return [...new Set(alternatives)];
    }
    getIntent(scope: DataScope, id: string) {
        return scopedTransaction(this.db, scope, async (tx) => { const row = await tx.referralIntent.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } }); if (!row)
            throw new RepositoryError('NOT_FOUND'); return row; });
    }
    get(scope: DataScope, id: string) {
        return scopedTransaction(this.db, scope, async (tx) => { const row = await tx.referralEvent.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } }); if (!row)
            throw new RepositoryError('NOT_FOUND'); return ReferralReceiptSchema.parse(row.payload); });
    }
    confirm(scope: DataScope, input: ConfirmReferralInput, clock: RealClock) {
        const payloadHash = digest({ intentId: input.intentId, acceptedQuoteVersion: input.acceptedQuoteVersion });
        return scopedTransaction(this.db, scope, async (tx) => {
            const now = clock.now();
            const previous = await tx.referralEvent.findUnique({ where: { sessionId_idempotencyKey: { sessionId: scope.sessionId, idempotencyKey: input.idempotencyKey } } });
            if (previous) {
                if (previous.payloadHash !== payloadHash)
                    throw new RepositoryError('IDEMPOTENCY_CONFLICT');
                return ReferralReceiptSchema.parse(previous.payload);
            }
            if (await tx.auditEvent.findFirst({ where: { sessionId: scope.sessionId, kind: 'referral-cancelled', payload: { path: ['intentId'], equals: input.intentId } } })) throw new RepositoryError('INTENT_EXPIRED');
            const row = await tx.referralIntent.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: input.intentId } } });
            if (!row)
                throw new RepositoryError('NOT_FOUND');
            if (row.expiresAt <= now)
                throw new RepositoryError('INTENT_EXPIRED');
            if (row.quoteVersion !== input.acceptedQuoteVersion)
                throw new RepositoryError('QUOTE_CHANGED');
            const stored = row.payload as unknown as StoredIntent;
            const intent = ReferralIntentSchema.parse(stored.intent);
            if (stored.digest !== digest(intent) || intent.intentId !== row.id || intent.selection.quoteId !== row.quoteId || intent.selection.quoteVersion !== row.quoteVersion || intent.expiresAt !== row.expiresAt.toISOString() || intent.createdAt !== row.createdAt.toISOString())
                throw new RepositoryError('QUOTE_CHANGED');
            if(intent.selection.kind==='hotel') {
                await new HotelRepository(this.db).assertHotelIntent(tx,scope,intent,stored.fingerprint,now);
            } else {
                const current = await this.current(tx, scope);
                if (this.fingerprint(current) !== stored.fingerprint)
                    throw new RepositoryError('QUOTE_CHANGED');
                const selected = await this.selected(tx, scope, intent.selection, now);
                const checked = this.evaluate(selected.row.offer!.payload, selected.query, current, new Date(selected.quote.observedAt));
                const quote = { ...checked.quote, quoteId: selected.quote.quoteId, version: selected.quote.version };
                const exact = { kind: 'transport', quote, itinerary: selected.itinerary };
                // Existing pending intents retain their exact legacy private payload.
                // Accept only a byte-equivalent re-evaluation; never rewrite history.
                const legacy = { kind: 'transport', quote, itinerary: checked.offer.itinerary };
                if ((canonicalValue(exact) !== canonicalValue(intent.quote) && canonicalValue(legacy) !== canonicalValue(intent.quote)) || canonicalValue(selected.quote) !== canonicalValue(intent.quote.quote))
                    throw new RepositoryError('QUOTE_CHANGED');
            }
            const id = randomUUID();
            const receipt = ReferralReceiptSchema.parse({ referralId: id, intentId: row.id, selection: intent.selection, payload: intent.quote, confirmedAt: now.toISOString(), handoffPath: `/provider-demo/${id}` });
            await tx.referralEvent.create({ data: { sessionId: scope.sessionId, id, intentId: row.id, idempotencyKey: input.idempotencyKey, payloadHash, payload: json(receipt), createdAt: now } });
            await this.audit(tx, scope, 'referral-confirmed', { referralId: id, intentId: row.id, payloadDigest: stored.digest }, now);
            return receipt;
        });
    }
    private audit(tx: Prisma.TransactionClient, scope: DataScope, kind: string, payload: unknown, now: Date) {
        return tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind, payload: json(payload), createdAt: now } });
    }
}
