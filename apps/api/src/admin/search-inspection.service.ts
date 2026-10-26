import type { AdminReplayInput, AdminSearchInspectionQuery, AdminSearchListQuery } from '@torob-ticket/contracts';
import { AdminSearchRepository, RepositoryError } from '@torob-ticket/data-access';
import type { SessionContext } from '../sessions/session-context';
import { SessionService } from '../sessions/session.service';
import { SearchService } from '../searches/search.service';

export class SearchInspectionService {
  constructor(private readonly sessions: SessionService, private readonly searches: SearchService) {}
  list(session: SessionContext, query: AdminSearchListQuery) { return new AdminSearchRepository(this.sessions.database).list(session.scope, query); }
  get(session: SessionContext, id: string, query: AdminSearchInspectionQuery) { return new AdminSearchRepository(this.sessions.database).inspect(session.scope, id, query); }
  /** Existing admission/recovery/scope/revision rules apply; never rewrite old evidence. */
  async replay(session: SessionContext, id: string, input: AdminReplayInput) {
    const prior = await this.searches.getSearch(session, id);
    if (prior.snapshot.status === 'collecting') throw new RepositoryError('INVALID_QUERY');
    return this.searches.retrySearch(session, id, input.clientGeneration);
  }
}
