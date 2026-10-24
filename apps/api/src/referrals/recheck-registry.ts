import type { ReferralSelection, RecheckResult } from '@torob-ticket/contracts';
import { mockRegistry, type ProviderAdapter, type ProviderContext, type ProviderQuoteSelection, type ProviderRecheck } from '@torob-ticket/provider-adapters';
import type { SessionContext } from '../sessions/session-context';
/** T20 can register a hotel engine against the same public prepare/result contract. */
export interface RecheckHandler {
  prepareReferral(session: SessionContext, selection: ReferralSelection): Promise<RecheckResult>;
}
export class RecheckRegistry {
  private readonly handlers = new Map<ReferralSelection['kind'], RecheckHandler>();
  constructor(private readonly adapters: readonly ProviderAdapter[] = mockRegistry) {}
  register(kind: ReferralSelection['kind'], handler: RecheckHandler) { this.handlers.set(kind, handler); }
  get(kind: ReferralSelection['kind']) { return this.handlers.get(kind); }
  recheckTransport(selection: ProviderQuoteSelection, context: ProviderContext): Promise<ProviderRecheck> {
    const adapter = this.adapters.find(row => row.providerId === selection.previous.providerId);
    return adapter ? adapter.recheck(selection, context) : Promise.resolve({ providerId: selection.previous.providerId, status: 'unsupported', outcome: 'unavailable' });
  }
}
