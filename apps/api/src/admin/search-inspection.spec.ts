import { describe, expect, it, vi } from 'vitest';
import type { SessionContext } from '../sessions/session-context';
import type { SessionService } from '../sessions/session.service';
import type { SearchService } from '../searches/search.service';
import { SearchInspectionService } from './search-inspection.service';

describe('admin replay ownership', () => {
  const session = { sessionId: 'owner', scope: { sessionId: 'owner' } } as SessionContext;
  it('does not supersede or rewrite a collecting predecessor', async () => {
    const searches = { getSearch: vi.fn().mockResolvedValue({ snapshot: { status: 'collecting' } }), retrySearch: vi.fn() };
    const service = new SearchInspectionService({} as SessionService, searches as unknown as SearchService);
    await expect(service.replay(session, 'old', { clientGeneration: 'fresh' })).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    expect(searches.retrySearch).not.toHaveBeenCalled();
  });
  it('reads only the owner and delegates a terminal replay with the exact new generation', async () => {
    const result = { snapshot: { searchId: 'new', predecessorSearchId: 'old' }, sequence: 1 };
    const searches = { getSearch: vi.fn().mockResolvedValue({ snapshot: { status: 'partial' } }), retrySearch: vi.fn().mockResolvedValue(result) };
    const service = new SearchInspectionService({} as SessionService, searches as unknown as SearchService);
    expect(await service.replay(session, 'old', { clientGeneration: 'fresh' })).toBe(result);
    expect(searches.getSearch).toHaveBeenCalledWith(session, 'old');
    expect(searches.retrySearch).toHaveBeenCalledExactlyOnceWith(session, 'old', 'fresh');
  });
  it('foreign/removed predecessors fail before starting any new work', async () => {
    const error = Object.assign(new Error('missing'), { code: 'NOT_FOUND' });
    const searches = { getSearch: vi.fn().mockRejectedValue(error), retrySearch: vi.fn() };
    const service = new SearchInspectionService({} as SessionService, searches as unknown as SearchService);
    await expect(service.replay(session, 'foreign', { clientGeneration: 'fresh' })).rejects.toBe(error);
    expect(searches.retrySearch).not.toHaveBeenCalled();
  });
});
