import { describe, expect, it } from 'vitest';
import { formatTomanParts, normalizeMoney } from './money';

describe('canonical whole-party money', () => {
  it.each([
    ['2,500,000', 'TOMAN', 25000000], ['۲٬۵۰۰٬۰۰۰', 'TOMAN', 25000000],
    ['٢٬٥٠٠٬٠٠٠', 'IRR', 2500000], ['2500000', 'IRR', 2500000],
    [0, 'IRR', 0], [12.3, 'TOMAN', 123], ['۱۲٫۳', 'TOMAN', 123],
    [Number.MAX_SAFE_INTEGER, 'IRR', 9007199254740991],
    ['900719925474099.1', 'TOMAN', 9007199254740991],
  ] as const)('normalizes %s %s to integer rials', (source, unit, amountRial) => {
    expect(normalizeMoney(source, unit)).toEqual({ amountRial, currency: 'IRR' });
  });

  it.each(['', '-1', '1e6', '1,00', '1 000', '1,234٬567', '1.01', '1 تومان', 'NaN'])('rejects ambiguous/invalid source %s', source => {
    expect(() => normalizeMoney(source, 'TOMAN')).toThrow();
  });
  it.each([NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1])('rejects unsafe/negative numeric rials %s', source => {
    expect(() => normalizeMoney(source, 'IRR')).toThrow();
  });
  it('rejects fractional rials and conversion overflow', () => {
    expect(() => normalizeMoney('1.1', 'IRR')).toThrow();
    expect(() => normalizeMoney(Number.MAX_SAFE_INTEGER, 'TOMAN')).toThrow();
  });
  it('requires an explicit supported unit at runtime', () => {
    expect(() => normalizeMoney('100', undefined as never)).toThrow();
    expect(() => normalizeMoney('100', 'USD' as never)).toThrow();
  });
  it('formats exact tenths in Latin digits without dropping a rial', () => {
    expect(formatTomanParts({ amountRial: 25000001, currency: 'IRR' }, 'en-US').map(p => p.value).join('')).toBe('2,500,000.1');
    expect(formatTomanParts({ amountRial: 9007199254740989, currency: 'IRR' }, 'en-US').map(p => p.value).join('')).toBe('900,719,925,474,098.9');
    expect(formatTomanParts({ amountRial: 9007199254740991, currency: 'IRR' }, 'en-US').map(p => p.value).join('')).toBe('900,719,925,474,099.1');
  });
  it('uses Persian digits by default and preserves structured decimal parts', () => {
    const parts = formatTomanParts({ amountRial: 25000001, currency: 'IRR' });
    expect(parts.map(p => p.value).join('')).toBe('۲٬۵۰۰٬۰۰۰٫۱');
    expect(parts.find(p => p.type === 'fraction')?.value).toBe('۱');
    expect(formatTomanParts({ amountRial: 25000000, currency: 'IRR' }).map(p => p.value).join('')).toBe('۲٬۵۰۰٬۰۰۰');
  });
  it('rejects invalid canonical money when formatting', () => {
    expect(() => formatTomanParts({ amountRial: -1, currency: 'IRR' })).toThrow();
  });
});
