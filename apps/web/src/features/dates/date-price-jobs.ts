import { ClientError, type ApiClient } from '@torob-ticket/client';
import type { DatePriceQuery, DatePriceSnapshot, SessionInfo } from '@torob-ticket/contracts';
import { searchStartPool } from '../search/search-start-pool';
import { datePriceIdentityForSession, matchesDateSnapshot, snapshotReusable, observationUsable } from './date-state';
export interface DateJobState { snapshot?: DatePriceSnapshot; error?: unknown; waiting: boolean }
interface Job { request: DatePriceQuery; state: DateJobState; listeners: Set<(state: DateJobState) => void>; abort: AbortController; cancelled: boolean; finished: boolean; done: Promise<void>; releaseTimer?: ReturnType<typeof setTimeout> }
function pause(ms: number, signal: AbortSignal) { return new Promise<void>((resolve, reject) => { const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms); function abort() { clearTimeout(timer); reject(new DOMException('Aborted','AbortError')); } signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); }); }
/** One semantic job per API-client lifetime. Its generation belongs to pricing, not result sorting. */
export class DatePriceJobs {
  private jobs = new Map<string, Job>();
  private epoch: number;
  constructor(private client: ApiClient) { this.epoch = searchStartPool(client).epoch; }
  acquire(input: DatePriceQuery, session: SessionInfo, listener: (state: DateJobState) => void, retry = false) {
    const pool = searchStartPool(this.client);
    if (this.epoch !== pool.epoch) { for (const job of this.jobs.values()) { job.cancelled = true; job.abort.abort(); } this.jobs.clear(); this.epoch = pool.epoch; }
    for (const [oldKey, old] of this.jobs) { if (!old.listeners.size && old.finished && (old.cancelled || old.state.error || this.jobs.size > 24)) this.jobs.delete(oldKey); }
    const key = datePriceIdentityForSession(input, session);
    let job = this.jobs.get(key);
    const reusable = job && !job.cancelled && !job.state.error && (!job.state.snapshot || job.state.snapshot.status === 'checking' || snapshotReusable(job.state.snapshot));
    if (!reusable || (retry && job?.state.snapshot?.status !== 'checking')) {
      const previous = job?.done;
      job = { request: { ...input, clientGeneration: crypto.randomUUID() }, state: { waiting: true }, listeners: new Set(), abort: new AbortController(), cancelled: false, finished: false, done: Promise.resolve() };
      this.jobs.set(key, job);
      const owned = job;
      // Defer until subscription is installed; a retired same-key job finishes exact-ID cleanup first.
      job.done = Promise.resolve().then(async () => { if (previous) await previous; await this.run(owned, session, this.epoch); });
    }
    const owned = job!;
    clearTimeout(owned.releaseTimer); owned.listeners.add(listener); listener(owned.state);
    return () => {
      owned.listeners.delete(listener);
      if (!owned.listeners.size && (!owned.state.snapshot || owned.state.snapshot.status === 'checking')) owned.releaseTimer = setTimeout(() => { if (!owned.listeners.size) { owned.cancelled = true; owned.abort.abort(); } }, 0);
    };
  }
  private publish(job: Job, state: DateJobState) { job.state = state; for (const listener of job.listeners) listener(state); }
  private async run(job: Job, session: SessionInfo, epoch: number) {
    const pool = searchStartPool(this.client);
    let slot: ReturnType<typeof pool.reserve>;
    let id: string | undefined; let terminal = false;
    const inactive = () => job.cancelled || pool.epoch !== epoch || pool.getSnapshot().resetting;
    try {
      while (!slot && !inactive()) {
        slot = pool.reserve('date-read');
        if (!slot) await new Promise<void>(resolve => { const unsubscribe = pool.subscribe(() => { unsubscribe(); job.abort.signal.removeEventListener('abort', onAbort); resolve(); }); function onAbort() { unsubscribe(); resolve(); } job.abort.signal.addEventListener('abort', onAbort, { once: true }); if (job.abort.signal.aborted) onAbort(); });
      }
      if (!slot || inactive()) return;
      this.publish(job, { waiting: false });
      // Keep the slot through ID validation/polling/cleanup: dates and selected jobs share capacity.
      let snapshot = await this.client.startDatePrices(job.request, slot.signal);
      id = snapshot.datePriceId;
      if (!matchesDateSnapshot(snapshot, job.request, session, id)) throw new ClientError('schema', 'date-response-query-mismatch');
      let polls = 0;
      while (!inactive()) {
        terminal = snapshot.status !== 'checking';
        if (snapshot.status === 'complete' && !observationUsable(snapshot)) throw new ClientError('schema','date-observation-invalid');
        snapshot = { ...snapshot, cells: [...snapshot.cells].sort((a,b) => a.date.localeCompare(b.date)) };
        this.publish(job, { snapshot, waiting: false });
        if (snapshot.status !== 'checking') return;
        if (++polls > 35) throw new ClientError('network','date-poll-deadline');
        await pause(200, job.abort.signal);
        snapshot = await this.client.getDatePrices(id, job.request.clientGeneration, job.abort.signal);
        if (!matchesDateSnapshot(snapshot, job.request, session, id)) throw new ClientError('schema', 'date-response-query-mismatch');
      }
    } catch (error) { if (!inactive()) this.publish(job, { ...job.state, waiting: false, error }); }
    finally {
      if (id && !terminal && (inactive() || job.state.error)) await this.client.cancelDatePrices(id, job.request.clientGeneration).catch(() => undefined);
      job.finished = true; slot?.finish();
    }
  }
}
const registries = new WeakMap<ApiClient, DatePriceJobs>();
export function datePriceJobs(client: ApiClient): DatePriceJobs { let value = registries.get(client); if (!value) { value = new DatePriceJobs(client); registries.set(client, value); } return value; }
