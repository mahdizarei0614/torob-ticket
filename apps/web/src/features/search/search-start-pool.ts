import type { ApiClient } from '@torob-ticket/client';

export const unresolvedStartLimit = 2;
export const startCapacityMessage = 'دو درخواست جست‌وجو در انتظار پاسخ است. برای پاسخ صبر کنید یا از «کاوش نسخه نمایشی» نشست خود را دوباره شروع کنید.';
interface StartSnapshot { count: number; resetting: boolean }
interface StartEntry { abort: AbortController; done: Promise<void> }

/** Browser-client lifetime, deliberately longer than a mounted search controller.
 * A slot includes stale-ID cleanup; navigation never creates extra capacity.
 */
class SearchStartPool {
  private entries = new Map<symbol, StartEntry>();
  private listeners = new Set<() => void>();
  private snapshot: StartSnapshot = { count: 0, resetting: false };
  epoch = 0;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private publish(resetting = this.snapshot.resetting) {
    this.snapshot = { count: this.entries.size, resetting };
    for (const listener of this.listeners) listener();
  }
  reserve() {
    if (this.snapshot.resetting || this.entries.size >= unresolvedStartLimit) return undefined;
    const key = Symbol('search-start');
    const abort = new AbortController();
    let settle!: () => void;
    const done = new Promise<void>(resolve => { settle = resolve; });
    this.entries.set(key, { abort, done });
    this.publish();
    return {
      signal: abort.signal,
      epoch: this.epoch,
      finish: () => {
        if (!this.entries.delete(key)) return;
        settle();
        this.publish();
      },
    };
  }
  beginReset() {
    if (this.snapshot.resetting) return false;
    this.epoch++;
    this.publish(true);
    for (const entry of this.entries.values()) entry.abort.abort();
    return true;
  }
  pending() { return [...this.entries.values()].map(entry => entry.done); }
  resetFailed() { this.publish(false); }
}
const pools = new WeakMap<ApiClient, SearchStartPool>();
export function searchStartPool(client: ApiClient): SearchStartPool {
  let pool = pools.get(client);
  if (!pool) { pool = new SearchStartPool(); pools.set(client, pool); }
  return pool;
}
