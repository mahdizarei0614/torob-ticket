import { QuoteSnapshotSchema, type ComparisonGroup, type QuoteSnapshot, type SortOrder } from '@torob-ticket/contracts';

export function compareStableIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Inspect already evaluated quotes; never reprice, refresh or reconstruct eligibility. */
export function currentQuote(group: ComparisonGroup, quoteId: string | undefined): QuoteSnapshot | undefined {
  const matches = group.eligibleQuotes.filter(quote => quote.quoteId === quoteId);
  const quote = matches.length === 1 ? matches[0] : undefined;
  if (!quote || !QuoteSnapshotSchema.safeParse(quote).success) return undefined;
  if (quote.itineraryId !== group.itinerary.itineraryId) return undefined;
  if (quote.completeness.status !== 'complete' || quote.eligibility.status !== 'eligible') return undefined;
  return quote;
}

export function representativeQuote(group: ComparisonGroup): QuoteSnapshot | undefined {
  return currentQuote(group, group.representativeQuoteId);
}

/** Incomplete-only or invalid representative groups remain visible after priced results. */
export function rankGroups(groups: readonly ComparisonGroup[], sort: SortOrder = 'cheapest'): ComparisonGroup[] {
  const entries = groups.map(group => ({ group, quote: representativeQuote(group) }));
  entries.sort((a, b) => {
    const stable = compareStableIds(a.group.groupId, b.group.groupId);
    if (!a.quote || !b.quote) {
      if (a.quote) return -1;
      if (b.quote) return 1;
      return stable;
    }
    const price = a.quote.total.amountRial - b.quote.total.amountRial;
    const duration = a.group.durationMinutes - b.group.durationMinutes;
    const connections = a.group.connectionCount - b.group.connectionCount;
    if (sort === 'fastest') return duration || price || connections || stable;
    if (sort === 'fewest-connections') return connections || duration || price || stable;
    return price || duration || connections || stable;
  });
  return entries.map(entry => entry.group);
}
