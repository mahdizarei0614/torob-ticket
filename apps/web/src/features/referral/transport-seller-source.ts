import type { QuoteSnapshot } from '@torob-ticket/contracts';
import type { ResultsEvidence } from '../results/results-page';
import { quoteStatus } from '../results/results-reducer';
import type { ReferralSource } from './referral-controller';

/** Resolve after the exact seller is selected: a rendered sibling icon never owns the previous seller's lease. */
export function transportSellerSource({quote,groupId,evidence,canSelect,currentSource}:{
  quote:QuoteSnapshot;groupId:string;evidence:ResultsEvidence|undefined;
  canSelect:()=>boolean;currentSource:()=>ReferralSource|undefined;
}):ReferralSource|undefined {
  if (!canSelect() || !evidence) return undefined;
  const group=evidence.state.adopted?.snapshot.groups.find(group=>group.groupId===groupId);
  const canonical=group?.eligibleQuotes.find(item=>item.quoteId===quote.quoteId&&item.version===quote.version);
  if (!canonical || canonical.providerId!==quote.providerId || canonical.total.amountRial!==quote.total.amountRial || canonical.total.currency!==quote.total.currency) return undefined;
  const selection={groupId,quoteId:quote.quoteId,version:quote.version};
  const status=quoteStatus(evidence.state,selection,Date.now());
  const existing=currentSource();
  // Preserve an accepted/recoverable version instead of selecting its historical comparison version again.
  if (evidence.state.selected?.groupId===groupId && evidence.state.selected.quoteId===quote.quoteId && evidence.state.selected.version===quote.version && existing?.payload.kind==='transport' && existing.payload.quote.quoteId===quote.quoteId && existing.payload.quote.providerId===quote.providerId && existing.payload.itinerary.itineraryId===group?.itinerary.itineraryId && (existing.payload.quote.version>quote.version || status==='current') && existing.isCurrent()) return existing;
  if (status!=='current') return undefined;
  evidence.select(selection);
  const source=currentSource();
  return canSelect() && source?.payload.kind==='transport' && source.payload.quote.quoteId===quote.quoteId && source.payload.quote.version===quote.version && source.payload.itinerary.itineraryId===group?.itinerary.itineraryId && source.isCurrent() ? source : undefined;
}
