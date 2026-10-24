import type { ServerResponse } from 'node:http';
import type { SessionContext } from '../sessions/session-context';
import { sessionError } from '../sessions/session.service';
import { SearchService } from './search.service';

/** One sequential DB reader per response. No replay/live handoff or unbounded queue. */
export class SearchStreamService {
  private readonly streams = new Set<AbortController>();
  constructor(private readonly searches: SearchService) {}
  async serve(session: SessionContext, id: string, lastId: string | undefined, response: ServerResponse) {
    if (lastId !== undefined && !/^(0|[1-9]\d*)$/.test(lastId)) throw sessionError('INVALID_QUERY', 400);
    let cursor = Number(lastId ?? 0);
    if (!Number.isSafeInteger(cursor)) throw sessionError('INVALID_QUERY', 400);
    let page = await this.searches.readSearch(session, id, cursor);
    if (cursor > page.sequence) throw sessionError('INVALID_QUERY', 400);
    const controller = new AbortController();
    this.streams.add(controller);
    const close = () => controller.abort();
    response.on('close', close);
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    response.flushHeaders();
    let heartbeat = Date.now();
    try {
      while (!controller.signal.aborted) {
        if (page.events[0] && page.events[0].sequence !== cursor + 1) {
          await this.write(response, controller.signal, `id: ${page.sequence}\ndata: ${JSON.stringify({ searchId: id, clientGeneration: page.snapshot.clientGeneration, sequence: page.sequence, type: page.snapshot.status === 'collecting' ? 'snapshot' : 'terminal', payload: page.snapshot })}\n\n`);
          cursor = page.sequence;
        } else for (const event of page.events) {
          await this.write(response, controller.signal, `id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`);
          cursor = event.sequence;
        }
        if (page.snapshot.status !== 'collecting' && cursor >= page.sequence) break;
        if (Date.now() - heartbeat >= 15000) { await this.write(response, controller.signal, ': heartbeat\n\n'); heartbeat = Date.now(); }
        if (cursor >= page.sequence) await this.delay(controller.signal);
        if (!controller.signal.aborted) page = await this.searches.readSearch(session, id, cursor);
      }
    } catch { /* Storage loss/reset ends this stream; reconnect uses the durable snapshot. */ }
    finally { controller.abort(); response.off('close', close); this.streams.delete(controller); response.end(); }
  }
  private delay(signal: AbortSignal) {
    return new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
      const timer = setTimeout(done, 100);
      signal.addEventListener('abort', done, { once: true });
      if (signal.aborted) done();
    });
  }
  private write(response: ServerResponse, signal: AbortSignal, value: string) {
    if (signal.aborted || response.destroyed) return Promise.resolve();
    if (response.write(value)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); response.off('drain', drained); signal.removeEventListener('abort', aborted); };
      const drained = () => { cleanup(); resolve(); };
      const aborted = () => { cleanup(); reject(new Error('stream-closed')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('slow-reader')); }, 5000);
      response.once('drain', drained); signal.addEventListener('abort', aborted, { once: true });
      if (signal.aborted) aborted();
    });
  }
  onModuleDestroy() { for (const controller of this.streams) controller.abort(); }
}
