import { describe, expect, it } from 'vitest';
import { priceBand, priceRange } from './price-band';

describe('comparable price bands', () => {
  it('includes nearby prices and exact quarter boundaries without depending on order or duplicates', () => {
    const range = priceRange([500,100,200,300,400,100]);
    expect([100,150,200,201,300,399,400,450,500].map(amount => priceBand(amount,range)))
      .toEqual(['low','low','low','mid','mid','mid','high','high','high']);
    expect(priceRange([100,200,300,400,500])).toEqual(range);
  });
  it('preserves real zero prices and leaves missing values unclassified', () => {
    const range = priceRange([0,100,NaN,Infinity,-1]);
    expect(range).toEqual({ min:0,max:100 });
    expect(priceBand(0,range)).toBe('low');
    expect(priceBand(undefined,range)).toBe('unknown');
    expect(priceBand(NaN,range)).toBe('unknown');
    expect(priceBand(100,priceRange([]))).toBe('unknown');
  });
  it('does not imply an advantage when every known price is equal', () => {
    expect(priceBand(100,priceRange([100,100]))).toBe('mid');
    expect(priceBand(0,priceRange([0]))).toBe('mid');
  });
});
