import { expect, it } from 'vitest';
import * as client from './index';
it('deduplicates the same event and refuses stale-generation delivery', async () => {
  const received: unknown[] = [];
  const frames = [
    { searchId: 'search', clientGeneration: 'g', sequence: 1, type: 'provider-status', payload: { providerId: 'p', status: 'running', offerCount: 0 } },
    { searchId: 'search', clientGeneration: 'g', sequence: 1, type: 'provider-status', payload: { providerId: 'p', status: 'running', offerCount: 0 } },
    { searchId: 'search', clientGeneration: 'old', sequence: 2, type: 'provider-status', payload: { providerId: 'p', status: 'complete', offerCount: 1 } },
  ];
  const subscribe = (client as unknown as { subscribeSearch?: (options: unknown) => () => void }).subscribeSearch ?? (() => () => undefined);
  let deliver: ((event: unknown) => void) | undefined;
  const stop = subscribe({ searchId: 'search', clientGeneration: 'g', onEvent: (event: unknown) => received.push(event),
    transport: { stream: async (_id: string, _after: number, _signal: AbortSignal, emit: (event: unknown) => void) => { deliver = emit; await new Promise(() => undefined); } } });
  await Promise.resolve();
  for (const frame of frames) deliver?.(frame);
  expect(received).toEqual([frames[0]]);
  stop();
});

import { afterEach, vi } from 'vitest';
import { subscribeSearch, searchTransport, type SearchTransport } from './search-stream';
import type { SearchRecovery, SearchEvent } from '@torob-ticket/contracts';
function recovery(sequence = 3, status: 'collecting' | 'complete' = 'collecting'): SearchRecovery {
  return { sequence, snapshot: { searchId: 'search', clientGeneration: 'g', query: { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' }, status, groups: [], providerStatuses: [], coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: status === 'complete' }, observedAt: '2026-10-24T12:00:00Z' } };
}
const event = (sequence: number): SearchEvent => ({ searchId: 'search', clientGeneration: 'g', sequence, type: 'provider-status', payload: { providerId: 'p', status: 'complete', offerCount: 1 } });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('recovers a gap atomically and reconnects after the snapshot cursor without delivering skipped frames', async () => {
  vi.useFakeTimers(); const events: SearchEvent[] = []; const snapshots: SearchRecovery[] = []; const cursors: number[] = [];
  let emit!: (event: unknown) => void;
  const transport: SearchTransport = { stream: async (_id, cursor, signal, receive) => { cursors.push(cursor); emit = receive; await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true })); }, snapshot: async () => recovery(4) };
  const stop = subscribeSearch({ searchId: 'search', clientGeneration: 'g', onEvent: value => events.push(value), onSnapshot: value => snapshots.push(value), transport });
  emit(event(1)); emit(event(3)); emit(event(4));
  await vi.advanceTimersByTimeAsync(250);
  expect(events.map(value => value.sequence)).toEqual([1]); expect(snapshots[0]?.sequence).toBe(4); expect(cursors).toEqual([0, 4]);
  emit(event(4)); emit(event(5)); expect(events.map(value => value.sequence)).toEqual([1, 5]);
  stop(); await vi.runAllTimersAsync(); expect(vi.getTimerCount()).toBe(0);
});
it('falls back after three reconnect retries and stops polling at a terminal snapshot', async () => {
  vi.useFakeTimers(); let streams = 0; let polls = 0; const snapshots: SearchRecovery[] = [];
  const transport: SearchTransport = { stream: async () => { streams++; throw new Error('offline'); }, snapshot: async () => { polls++; return recovery(3, polls >= 6 ? 'complete' : 'collecting'); } };
  const stop = subscribeSearch({ searchId: 'search', clientGeneration: 'g', onEvent: () => undefined, onSnapshot: value => snapshots.push(value), transport });
  await vi.advanceTimersByTimeAsync(5000);
  expect(streams).toBe(4); expect(polls).toBe(6); expect(snapshots.at(-1)?.snapshot.status).toBe('complete');
  await vi.advanceTimersByTimeAsync(10000); expect(polls).toBe(6); expect(vi.getTimerCount()).toBe(0); stop();
});
it('unsubscribe cancels every request and suppresses late gap recovery and prior-generation snapshots', async () => {
  vi.useFakeTimers(); let emit!: (event: unknown) => void; let resolve!: (value: SearchRecovery) => void;
  const signals: AbortSignal[] = []; const received: unknown[] = [];
  const transport: SearchTransport = { stream: async (_id, _cursor, signal, receive) => { emit = receive; signals.push(signal); await new Promise<void>(done => signal.addEventListener('abort', () => done(), { once: true })); }, snapshot: async (_id, signal) => { signals.push(signal); return new Promise(done => { resolve = done; }); } };
  const stop = subscribeSearch({ searchId: 'search', clientGeneration: 'g', onEvent: value => received.push(value), onSnapshot: value => received.push(value), transport });
  emit(event(2)); stop(); resolve(recovery()); await vi.runAllTimersAsync();
  expect(received).toEqual([]); expect(signals.every(signal => signal.aborted)).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
it('terminal frames close immediately and invalid wire frames cannot mutate state', async () => {
  vi.useFakeTimers(); let emit!: (event: unknown) => void; let signal!: AbortSignal; const received: unknown[] = [];
  const transport: SearchTransport = { stream: async (_id, _cursor, inputSignal, receive) => { emit = receive; signal = inputSignal; await new Promise<void>(done => signal.addEventListener('abort', () => done(), { once: true })); }, snapshot: async () => recovery() };
  const stop = subscribeSearch({ searchId: 'search', clientGeneration: 'g', onEvent: value => received.push(value), transport });
  expect(() => emit({ ...event(1), sequence: 0 })).toThrow(); expect(received).toEqual([]);
  emit({ ...event(1), type: 'terminal', payload: recovery(1, 'complete').snapshot });
  expect(signal.aborted).toBe(true); expect(received).toHaveLength(1); await vi.runAllTimersAsync(); expect(vi.getTimerCount()).toBe(0); stop();
});
it('real fetch transport handles split SSE frames, heartbeats and validates Last-Event-ID', async () => {
  const requested: unknown[] = []; const enc = new TextEncoder();
  vi.stubGlobal('fetch', async (url: unknown, init: unknown) => { requested.push([url, init]); return new Response(new ReadableStream({ start(controller) { controller.enqueue(enc.encode(': heartbeat\r\n\r\nid: 1\r\ndata: ')); controller.enqueue(enc.encode(JSON.stringify(event(1)) + '\r\n\r\n')); controller.close(); } }), { headers: { 'content-type': 'text/event-stream' } }); });
  const received: unknown[] = []; const signal = new AbortController().signal;
  await searchTransport.stream('search', 0, signal, value => received.push(value));
  expect(received).toEqual([event(1)]);
  expect(requested[0]).toEqual(['/api/v1/searches/search/events', { credentials: 'same-origin', headers: { Accept: 'text/event-stream', 'Last-Event-ID': '0' }, signal }]);
});
it('polling still delivers terminal state when only the event callback is supplied', async () => {
  vi.useFakeTimers(); const received: SearchEvent[] = [];
  const stop = subscribeSearch({ searchId: 'search', clientGeneration: 'g', onEvent: value => received.push(value), transport: { stream: async () => { throw new Error('offline'); }, snapshot: async () => recovery(2, 'complete') } });
  await vi.runAllTimersAsync();
  expect(received).toEqual([{ searchId: 'search', clientGeneration: 'g', sequence: 2, type: 'terminal', payload: recovery(2, 'complete').snapshot }]);
  stop();
});
it('ignores late delivery from an aborted connection after its replacement has started', async () => {
  vi.useFakeTimers(); const received: SearchEvent[] = []; const emitters: ((raw: unknown) => void)[] = [];
  const transport: SearchTransport = { stream: async (_id, _cursor, signal, receive) => { emitters.push(receive); await new Promise<void>(done => signal.addEventListener('abort', () => done(), { once: true })); }, snapshot: async () => recovery(3) };
  const stop = subscribeSearch({ searchId: 'search', clientGeneration: 'g', onEvent: value => received.push(value), onSnapshot: () => undefined, transport });
  emitters[0]!(event(2)); await vi.advanceTimersByTimeAsync(250);
  expect(emitters).toHaveLength(2);
  emitters[0]!(event(4)); expect(received).toEqual([]);
  emitters[1]!(event(4)); expect(received).toEqual([event(4)]); stop(); await vi.runAllTimersAsync();
});
it('bounds a stalled snapshot request and unsubscribe clears its recovery timeout', async () => {
  vi.useFakeTimers(); const requests: AbortSignal[] = [];
  const stop = subscribeSearch({ searchId: 'search', clientGeneration: 'g', onEvent: () => undefined, transport: { stream: async () => { throw new Error('offline'); }, snapshot: async (_id, signal) => { requests.push(signal); return new Promise((_resolve, reject) => { signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); }); } } });
  await vi.advanceTimersByTimeAsync(5000);
  expect(requests[0]?.aborted).toBe(true);
  stop(); await vi.runAllTimersAsync(); expect(vi.getTimerCount()).toBe(0);
});
