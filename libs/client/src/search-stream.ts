import { SearchEventSchema, SearchRecoverySchema, type SearchEvent, type SearchRecovery } from '@torob-ticket/contracts';
export interface SearchTransport {
  stream(searchId: string, after: number, signal: AbortSignal, emit: (event: unknown) => void): Promise<void>;
  snapshot(searchId: string, signal: AbortSignal): Promise<unknown>;
}
export interface SubscribeSearchOptions {
  searchId: string;
  clientGeneration: string;
  sequence?: number;
  onEvent: (event: SearchEvent) => void;
  onSnapshot?: (recovery: SearchRecovery) => void;
  onError?: (error: unknown) => void;
  transport?: SearchTransport;
}
/** Same-origin cookie transport. Fetch permits explicit Last-Event-ID and cancellation. */
export const searchTransport: SearchTransport = {
  async stream(id, after, signal, emit) {
    const response = await fetch(`/api/v1/searches/${encodeURIComponent(id)}/events`, { credentials: 'same-origin', headers: { Accept: 'text/event-stream', 'Last-Event-ID': String(after) }, signal });
    if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('search-stream-unavailable');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let idle: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => { void reader.cancel().catch(() => undefined); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      while (!signal.aborted) {
        idle = setTimeout(cancel, 20000);
        const result = await reader.read();
        clearTimeout(idle);
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        if (buffer.length > 2 * 1024 * 1024) throw new Error('search-frame-too-large');
        buffer = buffer.replace(/\r\n/g, '\n');
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          const lines = frame.split('\n');
          const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (!data) continue;
          const event: unknown = JSON.parse(data);
          const parsed = SearchEventSchema.parse(event);
          const idLine = lines.find(line => line.startsWith('id:'));
          if (!idLine || idLine.slice(3).trim() !== String(parsed.sequence)) throw new Error('search-frame-id-mismatch');
          emit(parsed);
        }
      }
    } finally { clearTimeout(idle); signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  },
  async snapshot(id, signal) {
    const response = await fetch(`/api/v1/searches/${encodeURIComponent(id)}`, { credentials: 'same-origin', signal });
    if (!response.ok) throw new Error('search-snapshot-unavailable');
    return response.json();
  },
};

export function subscribeSearch(options: SubscribeSearchOptions): () => void {
  const lifetime = new AbortController();
  const transport = options.transport ?? searchTransport;
  let cursor = options.sequence ?? 0;
  let terminal = false;
  let connection: AbortController | undefined;
  let recovering: Promise<void> | undefined;
  const active = () => !lifetime.signal.aborted && !terminal;
  const stop = () => { lifetime.abort(); connection?.abort(); };
  const matches = (value: { searchId: string; clientGeneration: string }) => value.searchId === options.searchId && value.clientGeneration === options.clientGeneration;
  const recover = () => {
    if (recovering) return recovering;
    recovering = (async () => {
      const request = new AbortController();
      const abort = () => request.abort();
      lifetime.signal.addEventListener('abort', abort, { once: true });
      if (lifetime.signal.aborted) abort();
      const timeout = setTimeout(abort, 5000);
      let raw: unknown;
      try { raw = await transport.snapshot(options.searchId, request.signal); }
      finally { clearTimeout(timeout); lifetime.signal.removeEventListener('abort', abort); }
      const recovery = SearchRecoverySchema.parse(raw);
      if (!active() || !matches(recovery.snapshot)) return;
      if (recovery.sequence < cursor) throw new Error('stale-search-snapshot');
      cursor = recovery.sequence;
      if (options.onSnapshot) options.onSnapshot(recovery);
      else if (recovery.sequence > 0) options.onEvent({ searchId: options.searchId, clientGeneration: options.clientGeneration, sequence: recovery.sequence, type: recovery.snapshot.status === 'collecting' ? 'snapshot' : 'terminal', payload: recovery.snapshot });
      if (recovery.snapshot.status !== 'collecting') { terminal = true; connection?.abort(); }
    })().finally(() => { recovering = undefined; });
    return recovering;
  };
  const receive = (raw: unknown) => {
    if (!active() || recovering) return;
    const event = SearchEventSchema.parse(raw);
    if (!matches(event) || event.sequence <= cursor) return;
    if (event.sequence !== cursor + 1) {
      connection?.abort();
      void recover().catch(error => { if (active()) options.onError?.(error); });
      return;
    }
    cursor = event.sequence;
    options.onEvent(event);
    if (event.type === 'terminal') { terminal = true; connection?.abort(); }
  };
  const delay = (ms: number) => new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); lifetime.signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms);
    lifetime.signal.addEventListener('abort', done, { once: true });
    if (lifetime.signal.aborted) done();
  });
  void (async () => {
    const retryDelays = [250, 500, 1000];
    for (let attempt = 0; active() && attempt <= retryDelays.length; attempt++) {
      connection = new AbortController();
      const currentConnection = connection;
      const abort = () => currentConnection.abort();
      lifetime.signal.addEventListener('abort', abort, { once: true });
      try { await transport.stream(options.searchId, cursor, currentConnection.signal, raw => {
        if (connection === currentConnection && !currentConnection.signal.aborted) receive(raw);
      }); }
      catch (error) { if (active() && !connection.signal.aborted) options.onError?.(error); }
      finally { lifetime.signal.removeEventListener('abort', abort); connection.abort(); }
      if (recovering) await recovering.catch(() => undefined);
      if (!active()) return;
      // An EOF may arrive after a terminal frame was lost. Recover before reconnect.
      try { await recover(); } catch (error) { if (active()) options.onError?.(error); }
      if (active() && attempt < retryDelays.length) await delay(retryDelays[attempt]!);
    }
    while (active()) {
      try { await recover(); } catch (error) { if (active()) options.onError?.(error); }
      if (active()) await delay(1000);
    }
  })().catch(error => { if (active()) options.onError?.(error); });
  return stop;
}
