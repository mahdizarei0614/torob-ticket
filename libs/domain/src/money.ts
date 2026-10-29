import { MoneySchema, type Money } from '@torob-ticket/contracts';

export type SourceMoneyUnit = 'IRR' | 'TOMAN';

/** Source value/unit provenance stays with the caller; this never guesses a unit. */
export function normalizeMoney(value: string | number, unit: SourceMoneyUnit): Money {
  if (unit !== 'IRR' && unit !== 'TOMAN') throw new RangeError('Explicit IRR or TOMAN unit required');
  if (typeof value !== 'string' && typeof value !== 'number') throw new TypeError('Invalid money value');
  if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Money must be nonnegative and safe');
  }
  const source = String(value).trim()
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/٫/g, '.');
  if (source.includes(',') && source.includes('٬')) throw new RangeError('Mixed grouping separators');
  const grouped = source.replace(/٬/g, ',');
  const pattern = unit === 'TOMAN'
    ? /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d)?$/
    : /^(?:\d+|\d{1,3}(?:,\d{3})+)$/;
  if (!pattern.test(grouped)) throw new RangeError('Invalid money syntax or precision');
  const [integer = '', fraction = '0'] = grouped.replace(/,/g, '').split('.');
  const amount = unit === 'IRR' ? BigInt(integer) : BigInt(integer) * 10n + BigInt(fraction);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Rial amount exceeds safe integer range');
  return { amountRial: Number(amount), currency: 'IRR' };
}

type TomanFormatters = { integer: Intl.NumberFormat; fraction?: Intl.NumberFormat; decimal?: string };
const tomanFormatters = new Map<string, TomanFormatters>();
function formattersFor(locale: string): TomanFormatters {
  let value = tomanFormatters.get(locale);
  if (value) tomanFormatters.delete(locale);
  else value = { integer: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }) };
  tomanFormatters.set(locale, value);
  if (tomanFormatters.size > 32) tomanFormatters.delete(tomanFormatters.keys().next().value!);
  return value;
}

/** Numeric toman parts, with an exact tenth when needed. UI supplies the unit label. */
export function formatTomanParts(money: Money, locale = 'fa-IR'): Intl.NumberFormatPart[] {
  const { amountRial } = MoneySchema.parse(money);
  const rial = BigInt(amountRial);
  const formatters = formattersFor(locale);
  const parts = formatters.integer.formatToParts(rial / 10n);
  const tenth = Number(rial % 10n);
  if (!tenth) return parts;
  formatters.decimal ??= new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).formatToParts(0.1)
    .find(part => part.type === 'decimal')!.value;
  formatters.fraction ??= new Intl.NumberFormat(locale, { useGrouping: false });
  return [...parts, { type: 'decimal', value: formatters.decimal }, { type: 'fraction', value: formatters.fraction.format(tenth) }];
}
