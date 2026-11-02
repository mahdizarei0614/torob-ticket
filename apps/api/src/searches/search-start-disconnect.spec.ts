import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import type { SearchRecovery, SearchRequest } from '@torob-ticket/contracts';
import type { SessionRequest } from '../sessions/session-context';
import { SearchController } from './search.controller';
import type { SearchService } from './search.service';
import type { SearchStreamService } from './search-stream.service';

function setup(destroyed = false) {
  let resolve!: (value: SearchRecovery) => void;
  const service = { startSearch: vi.fn(() => new Promise<SearchRecovery>(done => { resolve = done; })), cancelSearch: vi.fn(async () => undefined) };
  const controller = new SearchController(service as unknown as SearchService, {} as SearchStreamService);
  const response = Object.assign(new EventEmitter(), { writableFinished: false, destroyed });
  const session = { sessionId: 'owner' };
  const pending = controller.start({ sessionContext: session } as SessionRequest, {} as SearchRequest, response as unknown as ServerResponse);
  const result = { snapshot: { searchId: 'started' } } as SearchRecovery;
  return { response, service, session, pending, release: () => resolve(result) };
}
describe('search start response ownership', () => {
  it('cancels a start whose connection already closed during authentication', async () => {
    const test = setup(true); test.release(); await test.pending;
    expect(test.service.cancelSearch).toHaveBeenCalledExactlyOnceWith(test.session, 'started');
  });
  it('cancels an unknown admitted ID when the HTTP client disconnects before start resolves', async () => {
    const test = setup();
    test.response.emit('close');
    expect(test.service.cancelSearch).not.toHaveBeenCalled();
    test.release(); await test.pending;
    expect(test.service.cancelSearch).toHaveBeenCalledExactlyOnceWith(test.session, 'started');
  });
  it('cancels when start resolves but its response has not finished delivery', async () => {
    const test = setup(); test.release(); await test.pending;
    test.response.emit('close');
    expect(test.service.cancelSearch).toHaveBeenCalledExactlyOnceWith(test.session, 'started');
  });
  it('retains the durable run after a normally delivered response closes', async () => {
    const test = setup(); test.release(); await test.pending;
    test.response.writableFinished = true; test.response.emit('close');
    expect(test.service.cancelSearch).not.toHaveBeenCalled();
  });
});
