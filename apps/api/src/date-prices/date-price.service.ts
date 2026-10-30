import { DatePriceQuerySchema, DatePriceSnapshotSchema, NormalizedOfferSchema, type DatePriceQuery, type DatePriceSnapshot, type DatePriceCell } from '@torob-ticket/contracts';
import { DatePriceRepository, SearchRepository, RepositoryError, type DatePricePayload, type DatePriceProjectionInput } from '@torob-ticket/data-access';
import { datePriceIdentity, dateQueryState, projectDatePrices, type ComparisonContext, type SourceFareEvidence } from '@torob-ticket/domain';
import { activeTransportSourceRevision,farePoliciesForFixture } from '@torob-ticket/fixtures';
import { mockRegistry, type ProviderAdapter, type ProviderContext, type ProviderDateBatch } from '@torob-ticket/provider-adapters';
import type { SessionContext } from '../sessions/session-context';
import { SessionService } from '../sessions/session.service';
import { ProviderService } from '../providers/provider.service';
import { scheduleProviders } from '../searches/provider-scheduler';
interface ActiveDateRun { controller: AbortController; done: Promise<void> }
export class DatePriceService {
  private readonly active = new Map<string, ActiveDateRun>();
  private readonly pendingInterruptions = new Map<string, SessionContext>();
  private readonly unregisterRecovery: () => void;
  constructor(private readonly sessions: SessionService, private readonly providers: ProviderService, private readonly registry: readonly ProviderAdapter[] = mockRegistry,private readonly sourceRevisionForFixture:(fixtureVersion:string)=>string=activeTransportSourceRevision) {
    this.unregisterRecovery = sessions.registerRecovery(() => this.recover());
  }
  get repository() { return new DatePriceRepository(this.sessions.database); }
  private async recover() {
    for (const [id, owner] of this.pendingInterruptions) {
      try { await new SearchRepository(this.sessions.database).interrupt(owner.scope, id, this.sessions.realClock.now()); }
      catch (error) { if (!(error instanceof RepositoryError) || !['NOT_FOUND', 'SESSION_EXPIRED'].includes(error.code)) throw error; }
      this.pendingInterruptions.delete(id);
    }
    await this.repository.reconcileInterrupted();
  }
  private async interrupt(session: SessionContext, id: string) {
    this.pendingInterruptions.set(id, session);
    await this.recover();
  }
  async startDatePrices(session: SessionContext, request: DatePriceQuery): Promise<DatePriceSnapshot> {
    const input = DatePriceQuerySchema.parse(request);
    await this.recover();
    const now = this.sessions.realClock.now();
    const controller = new AbortController();
    let finish!: () => void;
    const done = new Promise<void>(resolve => { finish = resolve; });
    // Install session cancellation before the admission await: reset cannot miss this job.
    const release = this.sessions.registerController(session, controller, done);
    let id: string | undefined; let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const policies=farePoliciesForFixture(session.info.fixtureVersion);
      const sourceRevisions=Object.fromEntries(Object.keys(policies).map(id => [id, this.sourceRevisionForFixture(session.info.fixtureVersion)]));
      const admitted = await this.repository.admit(session.scope, input, now, { sourceRevisions, policyRevisions: Object.fromEntries(Object.entries(policies).map(([id, policy]) => [id, policy.revision])) });
      id = admitted.id;
      if (!admitted.created) { release(); finish(); return this.view(admitted.payload, input); }
      this.active.set(id, { controller, done });
      const deadline = new Date(now.getTime() + 5000);
      const context = await this.providers.createContext(session, id, controller.signal, deadline, admitted.payload.frozen,sourceRevisions);
      const expected = context.catalog.providerCapabilities.filter(row => row.modes.includes(input.query.mode) && row.scopes.includes(input.query.scope) && (!input.query.filters.providerIds || input.query.filters.providerIds.includes(row.providerId))).map(row => row.providerId);
      await this.repository.recordCoverage(session.scope, id, now, payload => {
        payload.coverageByDate = Object.fromEntries(payload.snapshot.query.dates.map(date => [date, { expectedProviderIds: expected, successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: expected, complete: false }]));
        payload.snapshot.cells=payload.snapshot.query.dates.map((date):DatePriceCell=>{
          const state=dateQueryState({request:payload.snapshot.query,...this.zones(context,payload.snapshot.query)},date);
          if(state==='invalid-date-pair')return{date,status:state,reason:'return-before-departure'};
          if(state==='outside-coverage')return{date,status:state};
          return{date,status:'checking'};
        });
      });
      timer = setTimeout(() => controller.abort('deadline'), Math.max(0, deadline.getTime() - this.sessions.realClock.now().getTime()));
      const runId = id;
      void this.execute(session, runId, context, expected).catch(async () => {
        controller.abort('storage'); await this.interrupt(session, runId).catch(() => undefined);
      }).finally(() => { clearTimeout(timer); release(); this.active.delete(runId); finish(); });
      return this.getDatePrices(session, id, input);
    } catch (error) {
      clearTimeout(timer); controller.abort(); release(); finish();
      if (id) { this.active.delete(id); await this.interrupt(session, id).catch(() => undefined); }
      throw error;
    }
  }
  private zones(context: ProviderContext, request: DatePriceQuery) {
    const origin = context.catalog.cities.find(city => city.id === request.query.originCityId);
    const destination = context.catalog.cities.find(city => city.id === request.query.destinationCityId);
    if (!origin || !destination) throw new RepositoryError('INVALID_QUERY');
    return { anchorInstant: context.demoClock.now().toISOString(), originTimeZone: origin.timeZone, destinationTimeZone: destination.timeZone };
  }
  private async execute(session: SessionContext, id: string, context: ProviderContext, expected: string[]) {
    const request = (await this.repository.read(session.scope, id)).snapshot.query;
    const dates = request.dates.filter(date => dateQueryState({ request, ...this.zones(context, request) }, date) === 'valid');
    if (dates.length) await scheduleProviders(expected, context.signal, async providerId => {
      const adapter = this.registry.find(adapter => adapter.providerId === providerId);
      let batch: ProviderDateBatch;
      try { batch = adapter ? await adapter.dateInventory({ ...request, dates }, context) : { providerId, status: 'failed', dates: [], errorCode: 'MISSING_PROVIDER' }; }
      catch { batch = { providerId, status: 'failed', dates: [], errorCode: 'PROVIDER_ERROR' }; }
      await this.repository.recordCoverage(session.scope, id, this.sessions.realClock.now(), payload => {
        payload.providerEvidence ??= {};
        payload.providerEvidence[providerId] = { status: batch.status, ...(batch.errorCode ? { errorCode: batch.errorCode } : {}), dates: batch.dates.map(item => ({ date: item.date, status: item.batch.status, ...(item.batch.errorCode ? { errorCode: item.batch.errorCode } : {}) })) };
        for (const date of payload.snapshot.query.dates) {
          const coverage = payload.coverageByDate[date]!;
          coverage.pendingProviderIds = coverage.pendingProviderIds.filter(value => value !== providerId);
          const matching = batch.dates.filter(item => item.date === date && item.batch.providerId === providerId);
          const successful = !context.signal.aborted && batch.providerId === providerId && batch.status === 'success' && matching.length === 1 && matching[0]!.batch.status === 'success';
          (successful ? coverage.successfulProviderIds : coverage.failedProviderIds).push(providerId);
        }
      },providerId).catch(error => { this.active.get(id)?.controller.abort('storage'); throw error; });
    });
    await this.repository.project(session.scope, id, this.sessions.realClock.now(), payload => {
      for (const coverage of Object.values(payload.coverageByDate)) {
        coverage.failedProviderIds.push(...coverage.pendingProviderIds); coverage.pendingProviderIds = []; coverage.complete = true;
      }
    }, state => this.project(context, state, context.signal.aborted && context.signal.reason !== 'deadline' ? 'interrupted' : 'complete'));
  }
  private project(context: ProviderContext, state: DatePriceProjectionInput, terminal?: 'complete' | 'interrupted') {
    const request = state.payload.snapshot.query;
    const sourceByOfferId: ComparisonContext['sourceByOfferId'] = {};
    const observationsByOfferId: Record<string, string> = {};
    const offers = state.offers.map(row => {
      const payload = row.payload as unknown as { offer: unknown; source?: SourceFareEvidence };
      const offer = NormalizedOfferSchema.parse(payload.offer);
      if (payload.source) sourceByOfferId[offer.offerId] = { rawRecordId: offer.provenance[0]!.rawRecordId, source: payload.source };
      observationsByOfferId[offer.offerId] = row.createdAt.toISOString(); return offer;
    });
    const projection = projectDatePrices({ request, ...this.zones(context, request), offers, comparison: { realClock: this.sessions.realClock, places: context.catalog.places, sourceByOfferId, policiesByProviderId: farePoliciesForFixture(context.fixtureVersion) }, observationsByOfferId, persistedQuotes: state.quotes, coverageByDate: state.payload.coverageByDate, interrupted: terminal === 'interrupted' });
    const snapshot = DatePriceSnapshotSchema.parse({ ...state.payload.snapshot, status: terminal ?? 'checking', cells: projection.cells, observedAt: this.sessions.realClock.now().toISOString() });
    return { snapshot, quotes: projection.quotes, audit: { providerEvidence: state.payload.providerEvidence, coverageByDate: state.payload.coverageByDate, quoteReferences: projection.quotes.map(item => ({ offerId: item.offerId, quoteId: item.quote.quoteId, version: item.quote.version })) } };
  }
  /** Full validated poll view can be supplied by clients; HTTP uses canonical query and generation. */
  private view(payload: DatePricePayload, request: DatePriceQuery | string): DatePriceSnapshot {
    if (typeof request !== 'string' && datePriceIdentity(request, payload.identity) !== datePriceIdentity(payload.snapshot.query, payload.identity)) throw new RepositoryError('INVALID_QUERY');
    const clientGeneration = typeof request === 'string' ? request : request.clientGeneration;
    return DatePriceSnapshotSchema.parse({ ...payload.snapshot, clientGeneration, query: { ...payload.snapshot.query, clientGeneration } });
  }
  async getDatePrices(session: SessionContext, id: string, view: DatePriceQuery | string): Promise<DatePriceSnapshot> {
    await this.recover(); return this.view(await this.repository.read(session.scope, id), view);
  }
  async cancelDatePrices(session: SessionContext, id: string, view: DatePriceQuery | string) {
    const payload = await this.repository.read(session.scope, id); this.view(payload, view);
    this.active.get(id)?.controller.abort('cancelled');
    await this.interrupt(session, id);
    return this.getDatePrices(session, id, view);
  }
  async onModuleDestroy() {
    this.unregisterRecovery();
    for (const run of this.active.values()) run.controller.abort('shutdown');
    await Promise.all([...this.active.values()].map(run => run.done));
    // Failed persistence remains in the recovery queue/startup reconciliation.
    // A liveness-only process must not instantiate storage during shutdown.
  }
}
