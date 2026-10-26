import {ClientError} from './api-client';
import {errorPolicy} from './error-policy';
import { ApiErrorSchema, SearchEventSchema, SearchRecoverySchema, type SearchEvent, type SearchRecovery } from '@torob-ticket/contracts';
export interface SearchTransport {
  stream(searchId: string, after: number, signal: AbortSignal, emit: (event: unknown) => void): Promise<void>;
  snapshot(searchId: string, signal: AbortSignal): Promise<unknown>;
}
export type SearchConnectionState='connecting'|'live'|'recovering'|'snapshot-only'|'settled'|'expired'|'unavailable';
export interface SubscribeSearchOptions {
  onStatus?: (status:SearchConnectionState)=>void;
  searchId: string;
  clientGeneration: string;
  sequence?: number;
  onEvent: (event: SearchEvent) => void;
  onSnapshot?: (recovery: SearchRecovery) => void;
  onError?: (error: unknown) => void;
  transport?: SearchTransport;
}
/** Error JSON is bounded and read before aborting the response; non-JSON streams are never consumed as JSON. */
async function streamResponseError(response:Response,signal:AbortSignal){
 let problem:unknown;
 if(response.headers.get('content-type')?.includes('application/json')&&response.body){
  const reader=response.body.getReader(),decoder=new TextDecoder();let text='';
  const cancel=()=>{void reader.cancel().catch(()=>undefined);};signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
  const timer=setTimeout(cancel,5000);
  try{while(!signal.aborted){const value=await reader.read();if(value.done)break;text+=decoder.decode(value.value,{stream:true});if(text.length>65536)break;}try{problem=JSON.parse(text);}catch{/* Invalid error content is not interpreted as protocol metadata. */}}
  finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>undefined);reader.releaseLock();}
 }
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const parsed=ApiErrorSchema.safeParse(problem);
 return parsed.success?new ClientError('api',parsed.data.code,parsed.data,response.status):new ClientError('http','search-stream-unavailable',undefined,response.status);
}
/** Same-origin cookie transport. Fetch permits explicit Last-Event-ID and cancellation. */
export const searchTransport: SearchTransport = {
  async stream(id, after, signal, emit) {
    // Bound connection establishment separately; healthy response bodies retain
    // their existing idle timeout rather than a five-second total lifetime.
    const connection = new AbortController();
    const abortConnection = () => connection.abort();
    signal.addEventListener('abort', abortConnection, { once: true });
    if (signal.aborted) abortConnection();
    const connectionTimeout = setTimeout(abortConnection, 5000);
    let response: Response;
    try {
      response = await fetch(`/api/v1/searches/${encodeURIComponent(id)}/events`, {
        credentials: 'same-origin',
        headers: { Accept: 'text/event-stream', 'Last-Event-ID': String(after) },
        signal: connection.signal,
      });
    } finally {
      clearTimeout(connectionTimeout);
      signal.removeEventListener('abort', abortConnection);
    }
    if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      // Headers detached the parent forwarding listener; rejected responses never
      // enter reader cleanup, so release their fetch and body here.
      try{throw await streamResponseError(response,signal);}
      finally{connection.abort();void response.body?.cancel().catch(()=>undefined);}
    }
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
    if (!response.ok){const problem=await response.json().catch(()=>undefined);const parsed=ApiErrorSchema.safeParse(problem);throw parsed.success?new ClientError('api',parsed.data.code,parsed.data,response.status):new ClientError('http','search-snapshot-unavailable',undefined,response.status);}
    return response.json();
  },
};

export function subscribeSearch(options: SubscribeSearchOptions): () => void {
  const lifetime = new AbortController();
  const transport = options.transport ?? searchTransport;
  let cursor = options.sequence ?? 0;
  let terminal = false;
  let connection: AbortController | undefined;
  let recovering: Promise<void> | undefined;let snapshotOnly=false;
  const status=(value:SearchConnectionState)=>{if(!lifetime.signal.aborted)options.onStatus?.(value);};
  const failed=(error:unknown)=>{if(!active())return;const policy=errorPolicy(error);options.onError?.(error);if(policy.kind==='expired'||policy.kind==='missing'){status(policy.kind==='expired'?'expired':'unavailable');terminal=true;connection?.abort();}else status(snapshotOnly?'snapshot-only':'recovering');};
  const active = () => !lifetime.signal.aborted && !terminal;
  const stop = () => { lifetime.abort(); connection?.abort(); };
  const matches = (value: { searchId: string; clientGeneration: string }) => value.searchId === options.searchId && value.clientGeneration === options.clientGeneration;
  const recover = () => {
    if (recovering) return recovering;
    status(snapshotOnly?'snapshot-only':'recovering');
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
      if (recovery.snapshot.status !== 'collecting') { status('settled'); terminal = true; connection?.abort(); }
    })().finally(() => { recovering = undefined; });
    return recovering;
  };
  const receive = (raw: unknown) => {
    if (!active() || recovering) return;
    const event = SearchEventSchema.parse(raw);
    if (!matches(event) || event.sequence <= cursor) return;
    if (event.sequence !== cursor + 1) {
      connection?.abort();
      void recover().catch(error => { failed(error); });
      return;
    }
    cursor = event.sequence;status('live');
    options.onEvent(event);
    if (event.type === 'terminal') { status('settled');terminal = true; connection?.abort(); }
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
      status('connecting');connection = new AbortController();
      const currentConnection = connection;
      const abort = () => currentConnection.abort();
      lifetime.signal.addEventListener('abort', abort, { once: true });
      try { await transport.stream(options.searchId, cursor, currentConnection.signal, raw => {
        if (connection === currentConnection && !currentConnection.signal.aborted) receive(raw);
      }); }
      catch (error) { if(active()&&!connection.signal.aborted)failed(error); }
      finally { lifetime.signal.removeEventListener('abort', abort); connection.abort(); }
      if (recovering) await recovering.catch(() => undefined);
      if (!active()) return;
      // An EOF may arrive after a terminal frame was lost. Recover before reconnect.
      try { await recover(); } catch (error) { failed(error); }
      if (active() && attempt < retryDelays.length) await delay(retryDelays[attempt]!);
    }
    if(!active())return;
    snapshotOnly=true;status('snapshot-only');
    while (active()) {
      try { await recover(); } catch (error) { failed(error); }
      if (active()) await delay(1000);
    }
  })().catch(error => { failed(error); });
  return stop;
}
