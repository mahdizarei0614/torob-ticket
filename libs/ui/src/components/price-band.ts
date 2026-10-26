export type PriceBand = 'low' | 'mid' | 'high' | 'unknown';
export interface PriceRange { min: number; max: number }

/** Compare known amounts in one currency and one search context; never substitute zero for missing data. */
export function priceRange(amounts: readonly number[]): PriceRange | undefined {
  const known = amounts.filter(amount => Number.isFinite(amount) && amount >= 0);
  return known.length ? { min: Math.min(...known), max: Math.max(...known) } : undefined;
}

/** Equal/sole prices carry no relative advantage. Quarter-range bands include their boundary values. */
export function priceBand(amount: number | undefined, range: PriceRange | undefined): PriceBand {
  if (amount === undefined || !Number.isFinite(amount) || amount < 0 || !range) return 'unknown';
  if (range.min === range.max) return 'mid';
  const position = (amount - range.min) / (range.max - range.min);
  return position <= .25 ? 'low' : position >= .75 ? 'high' : 'mid';
}
