import { AdminSearchRepository } from '@torob-ticket/data-access';
import { catalogForIdentity } from '@torob-ticket/fixtures';
import type { SessionContext } from '../sessions/session-context';
import { SessionService } from '../sessions/session.service';

export class ProviderHealthService {
  constructor(private readonly sessions: SessionService) {}
  get(session: SessionContext) {
    const providers = catalogForIdentity(session.info.fixtureVersion, session.info.catalogRevision).providerCapabilities.map(provider => provider.providerId);
    return new AdminSearchRepository(this.sessions.database).providerHealth(session.scope, providers);
  }
}
