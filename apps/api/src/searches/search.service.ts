import { randomUUID } from 'node:crypto';
import { SearchRequestSchema, SearchSnapshotSchema, NormalizedOfferSchema, type SearchRequest, type SearchSnapshot, type SearchStatus, type ProviderStatus, type QuoteSnapshot } from '@torob-ticket/contracts';
import { SearchRepository, RepositoryError, type ProjectionInput } from '@torob-ticket/data-access';
import { groupOffers, quoteOffer, rankGroups, explainGroup, chooseSuggestion, comparisonCoverage, type ComparisonContext, type ComparisonSnapshot, type SourceFareEvidence } from '@torob-ticket/domain';
import { farePoliciesForFixture } from '@torob-ticket/fixtures';
import { mockRegistry, type ProviderAdapter, type ProviderContext } from '@torob-ticket/provider-adapters';
import { ProviderService } from '../providers/provider.service';
import type { SessionContext } from '../sessions/session-context';
import { SessionService } from '../sessions/session.service';
import { scheduleProviders } from './provider-scheduler';

interface ActiveRun { controller: AbortController; done: Promise<void> }
export class SearchService {
  private readonly active = new Map<string, ActiveRun>();
  private readonly pendingInterruptions = new Map<string, SessionContext>();
  private readonly unregisterRecovery: () => void;
  constructor(private readonly sessions: SessionService, private readonly providers: ProviderService, private readonly registry: readonly ProviderAdapter[] = mockRegistry) {
    this.unregisterRecovery = sessions.registerRecovery(() => this.recoverInterrupted());
  }
  private async recoverInterrupted(session?: SessionContext) {
    for (const [id, owner] of this.pendingInterruptions) {
      if (session && owner.sessionId !== session.sessionId) continue;
      try { await this.repository.interrupt(owner.scope, id, this.sessions.realClock.now()); }
      catch (error) { if (!(error instanceof RepositoryError) || !['NOT_FOUND', 'SESSION_EXPIRED'].includes(error.code)) throw error; }
      this.pendingInterruptions.delete(id);
    }
  }
  private async interruptAfterFailure(session: SessionContext, id: string) {
    this.pendingInterruptions.set(id, session);
    await this.recoverInterrupted(session).catch(() => undefined);
  }
  get repository() { return new SearchRepository(this.sessions.database); }
  async startSearch(session: SessionContext, request: SearchRequest, predecessorId?: string) {
    await this.recoverInterrupted(session);
    const input = SearchRequestSchema.parse(request);
    const id = randomUUID();
    const now = this.sessions.realClock.now();
    const initial: SearchSnapshot = { searchId: id, clientGeneration: input.clientGeneration, query: input.query, status: 'collecting', groups: [], providerStatuses: [], coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: false }, observedAt: now.toISOString(), ...(predecessorId ? { predecessorSearchId: predecessorId } : {}) };
    await this.repository.create(session.scope, { query: input.query, clientGeneration: input.clientGeneration, snapshot: JSON.parse(JSON.stringify(initial)), ...(predecessorId ? { predecessorId } : {}) }, now, { id, enforceLimit: true, supersedesSearchId: input.supersedesSearchId });
    if (input.supersedesSearchId) this.active.get(input.supersedesSearchId)?.controller.abort('superseded');
    const controller = new AbortController();
    // Install ownership before context loading so reset/cancel cannot miss this job.
    let finish!: () => void;
    const done = new Promise<void>(resolve => { finish = resolve; });
    const release = this.sessions.registerController(session, controller, done);
    this.active.set(id, { controller, done });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Date(now.getTime() + 5000);
      const context = await this.providers.createContext(session, id, controller.signal, deadline);
      const expected = context.catalog.providerCapabilities.filter(row => row.modes.includes(input.query.mode) && row.scopes.includes(input.query.scope) && (!input.query.filters.providerIds || input.query.filters.providerIds.includes(row.providerId))).map(row => row.providerId);
      const adapters = expected.map(providerId => this.registry.find(adapter => adapter.providerId === providerId));
      if (adapters.some(adapter => !adapter)) throw new Error('Provider registry is incomplete');
      const frozen = { operationId: context.operationId, fixtureVersion: context.fixtureVersion, catalogRevision: context.catalog.catalogRevision, seed: context.seed, scenario: context.scenario, scenarioRevision: context.scenarioRevision, mappingRevision: context.mappingRevision, anchorInstant: context.demoClock.now().toISOString(), aliases: context.aliases, overrides: context.overrides, deadline: deadline.toISOString(), expectedProviderIds: expected, policies: farePoliciesForFixture(context.fixtureVersion) };
      await this.repository.freezeContext(session.scope, id, frozen, now);
      const statuses: ProviderStatus[] = expected.map(providerId => ({ providerId, status: 'pending', offerCount: 0 }));
      await this.repository.project(session.scope, id, now, state => this.project(session, context, { ...state, previous: { ...state.previous, providerStatuses: statuses } }));
      timer = setTimeout(() => controller.abort('deadline'), Math.max(0, deadline.getTime() - this.sessions.realClock.now().getTime()));
      void this.execute(session, id, context, adapters as ProviderAdapter[]).catch(async () => {
        // A failed persistence path is never represented as successful completion.
        controller.abort('storage');
        await this.interruptAfterFailure(session, id);
      }).finally(() => { clearTimeout(timer); release(); this.active.delete(id); finish(); });
      return this.getSearch(session, id);
    } catch (error) {
      clearTimeout(timer); controller.abort(); release(); this.active.delete(id); finish();
      await this.interruptAfterFailure(session, id);
      throw error;
    }
  }
  private async execute(session: SessionContext, id: string, context: ProviderContext, adapters: ProviderAdapter[]) {
    await scheduleProviders(adapters, context.signal, async adapter => {
      try {
        const started = this.sessions.realClock.now().getTime();
        await this.update(session, id, context, { providerId: adapter.providerId, status: 'running', offerCount: 0 });
        let batch;
        try { batch = await adapter.search((await this.repository.readSnapshot(session.scope, id)).snapshot.query, context); }
        catch { batch = { providerId: adapter.providerId, status: 'failed' as const, records: [], errorCode: 'PROVIDER_ERROR' }; }
        const status: ProviderStatus['status'] = context.signal.aborted ? context.signal.reason === 'deadline' ? 'timeout' : 'cancelled' : batch.status === 'success' ? 'complete' : batch.status === 'unsupported' ? 'failed' : batch.status;
        await this.update(session, id, context, { providerId: adapter.providerId, status, offerCount: batch.records.filter(record => record.offer).length, elapsedMs: Math.max(0, this.sessions.realClock.now().getTime() - started), ...(batch.errorCode ? { reason: batch.errorCode, retryable: true } : {}) });
      } catch (error) { this.active.get(id)?.controller.abort('storage'); throw error; }
    });
    if (context.signal.reason === 'shutdown') {
      await this.repository.interrupt(session.scope, id, this.sessions.realClock.now());
      return;
    }
    await this.repository.project(session.scope, id, this.sessions.realClock.now(), state => {
      const providerStatuses = state.previous.providerStatuses.map(row => row.status === 'pending' || row.status === 'running' ? { ...row, status: context.signal.reason === 'deadline' ? 'timeout' as const : 'cancelled' as const, reason: context.signal.reason === 'deadline' ? 'SEARCH_DEADLINE' : 'CANCELLED' } : row);
      return this.project(session, context, { ...state, previous: { ...state.previous, providerStatuses } }, context.signal.aborted && context.signal.reason !== 'deadline' ? 'cancelled' : 'finish');
    });
  }
  private update(session: SessionContext, id: string, context: ProviderContext, provider: ProviderStatus) {
    return this.repository.project(session.scope, id, this.sessions.realClock.now(), state => this.project(session, context, state), provider);
  }
  private project(session: SessionContext, context: ProviderContext, state: ProjectionInput, terminal?: 'finish' | 'cancelled') {
    const { previous } = state;
    const query = previous.query;
    const sourceByOfferId: ComparisonContext['sourceByOfferId'] = {};
    const observations = new Map<string, Date>();
    const offers = state.offers.map(row => {
      const payload = row.payload as unknown as { offer: unknown; source?: SourceFareEvidence };
      const offer = NormalizedOfferSchema.parse(payload.offer);
      if (payload.source) sourceByOfferId[offer.offerId] = { rawRecordId: offer.provenance[0]!.rawRecordId, source: payload.source };
      observations.set(offer.offerId, row.createdAt);
      return offer;
    });
    const policies=farePoliciesForFixture(context.fixtureVersion);
    const comparison: ComparisonContext = { realClock: this.sessions.realClock, places: context.catalog.places, policiesByProviderId: policies, sourceByOfferId };
    const persisted = new Map(state.quotes.map(quote => [`${quote.quoteId}:${quote.version}`, quote]));
    const quotes: { offerId: string; quote: QuoteSnapshot }[] = [];
    const evaluations = offers.map(offer => {
      const evaluation = quoteOffer(offer, query, { ...comparison, realClock: { now: () => new Date(observations.get(offer.offerId)!) } });
      if (evaluation.status === 'eligible') {
        evaluation.quote = persisted.get(`${evaluation.quote.quoteId}:${evaluation.quote.version}`) ?? evaluation.quote;
        quotes.push({ offerId: offer.offerId, quote: evaluation.quote });
      }
      return { offerId: offer.offerId, evaluation };
    });
    // Grouping never establishes a fresh lifetime: replace each generated quote with
    // the evaluated original observation (or its immutable persisted version).
    const byId = new Map(quotes.map(item => [item.quote.quoteId, item.quote]));
    const groups = rankGroups(groupOffers(offers, query, comparison).map(group => ({ ...group, eligibleQuotes: group.eligibleQuotes.map(quote => byId.get(quote.quoteId)!) })), query.sort);
    const providerStatuses = previous.providerStatuses.map(row => ({ ...row, offerCount: offers.filter(offer => offer.providerId === row.providerId).length }));
    const expectedProviderIds = providerStatuses.map(row => row.providerId);
    const coverageEvidence = { expectedProviderIds, providerStatuses, collectionComplete: !!terminal };
    const coverage = comparisonCoverage(coverageEvidence)!;
    let status: SearchStatus = 'collecting';
    if (terminal === 'cancelled') status = 'cancelled';
    else if (terminal) status = coverage.failedProviderIds.length ? groups.length ? 'partial' : 'failed' : groups.length ? 'complete' : 'empty';
    const sourceRevisionsByProviderId = Object.fromEntries(expectedProviderIds.map(id => [id, offers.find(offer => offer.providerId === id)?.provenance[0]?.sourceRevision ?? 'unobserved']));
    const current: ComparisonSnapshot = { query, groups, coverageEvidence, identity: { sessionId: session.sessionId, fixtureVersion: context.fixtureVersion, fixtureSeed: String(context.seed), mappingRevision: context.mappingRevision, scenarioRevision: context.scenarioRevision, policyRevision: Object.values(policies)[0]!.revision, sourceRevisionsByProviderId } };
    const baselineGroup = rankGroups(groups).find(group => group.representativeQuoteId);
    const baselineQuote = baselineGroup?.eligibleQuotes.find(quote => quote.quoteId === baselineGroup.representativeQuoteId);
    const explanations = baselineGroup && baselineQuote ? groups.flatMap(group => explainGroup(group, { ...current, baseline: { groupId: baselineGroup.groupId, quoteId: baselineQuote.quoteId, quoteVersion: baselineQuote.version } })) : [];
    const suggestion = chooseSuggestion({ searchId: previous.searchId, current, nearbyDates: [] });
    const snapshot = SearchSnapshotSchema.parse({ ...previous, groups, providerStatuses, coverage, status, explanations, suggestion, observedAt: this.sessions.realClock.now().toISOString() });
    return { snapshot, quotes, audit: { current, evaluations, quoteReferences: quotes.map(item => ({ offerId: item.offerId, quoteId: item.quote.quoteId, version: item.quote.version })), nearbyDates: [], explanations, suggestion } };
  }
  async readSearch(session: SessionContext, id: string, after = 0) {
    await this.recoverInterrupted(session);
    return this.repository.read(session.scope, id, after);
  }
  async getSearch(session: SessionContext, id: string) {
    await this.recoverInterrupted(session);
    return this.repository.readSnapshot(session.scope,id);
  }
  async cancelSearch(session: SessionContext, id: string) {
    await this.recoverInterrupted(session);
    await this.repository.cancel(session.scope, id, this.sessions.realClock.now());
    this.active.get(id)?.controller.abort('cancelled');
    return this.getSearch(session, id);
  }
  async retrySearch(session: SessionContext, id: string, clientGeneration: string) {
    const previous = await this.getSearch(session, id);
    return this.startSearch(session, { query: previous.snapshot.query, clientGeneration, supersedesSearchId: id }, id);
  }
  async onModuleDestroy() {
    this.unregisterRecovery();
    for (const run of this.active.values()) run.controller.abort('shutdown');
    await Promise.all([...this.active.values()].map(run => run.done));
  }
}
