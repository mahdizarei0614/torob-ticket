import type { ComparisonGroup, QuoteSnapshot, SortOrder } from '@torob-ticket/contracts';

export interface PriceCard {
  id: string;
  /** The canonical group identity remains the authority for quote selection. */
  group: ComparisonGroup;
  source: ComparisonGroup;
}

export function priceCardId(groupId: string, quote?: QuoteSnapshot): string {
  return JSON.stringify([groupId, quote?.total.currency ?? 'unknown', quote?.total.amountRial ?? null]);
}

/** Display projections only: never mutate server groups or manufacture a quote. */
export function priceCards(groups: readonly ComparisonGroup[], sort: SortOrder): PriceCard[] {
  const cards = groups.flatMap(source => {
    const buckets = new Map<string, QuoteSnapshot[]>();
    for (const quote of source.eligibleQuotes) {
      const id = priceCardId(source.groupId, quote);
      const quotes = buckets.get(id) ?? [];
      quotes.push(quote);
      buckets.set(id, quotes);
    }
    if (!buckets.size) return [{ id: priceCardId(source.groupId), source, group: source }];
    return [...buckets].map(([id, quotes]) => {
      quotes.sort((a,b) => a.quoteId.localeCompare(b.quoteId) || a.version-b.version);
      const representative = quotes.find(quote => quote.quoteId === source.representativeQuoteId) ?? quotes[0]!;
      return { id, source, group: { ...source, eligibleQuotes: quotes, representativeQuoteId: representative.quoteId,
        // Incomplete fares have no exact price; retain their evidence once, on the canonical representative card.
        incompletePriceOffers: representative.quoteId === source.representativeQuoteId ? source.incompletePriceOffers : [] } };
    });
  });
  return cards.sort((a,b) => {
    const amountA = a.group.eligibleQuotes[0]?.total.amountRial ?? Number.POSITIVE_INFINITY;
    const amountB = b.group.eligibleQuotes[0]?.total.amountRial ?? Number.POSITIVE_INFINITY;
    const amount = amountA === amountB ? 0 : amountA-amountB;
    const duration = a.group.durationMinutes-b.group.durationMinutes;
    const connections = a.group.connectionCount-b.group.connectionCount;
    const order = sort === 'fastest' ? duration || amount || connections : sort === 'fewest-connections' ? connections || duration || amount : amount || duration || connections;
    return order || a.group.groupId.localeCompare(b.group.groupId) || a.id.localeCompare(b.id);
  });
}
