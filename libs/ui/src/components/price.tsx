import { formatTomanParts } from '@torob-ticket/domain';
import { type Money } from '@torob-ticket/contracts';
import { languageProps, type Language } from './language';
import styles from '../styles/primitives.module.css';
import type { PriceBand } from './price-band';
export type PriceScope =
  { kind: 'party'; travelers: number } | { kind: 'stay'; rooms: number; nights: number };
export function Price({
  total,
  scope,
  language = 'fa',
  band,
}: {
  total: Money;
  scope: PriceScope;
  language?: Language;
  band?: PriceBand;
}) {
  const locale = language === 'fa' ? 'fa-IR' : 'en-US';
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const amount = formatTomanParts(total, locale)
    .map((part) => part.value)
    .join('');
  const unit = language === 'fa' ? 'تومان' : 'toman';
  const label =
    scope.kind === 'party'
      ? language === 'fa'
        ? `مجموع ${number(scope.travelers)} مسافر`
        : `Total for all ${number(scope.travelers)} travelers`
      : language === 'fa'
        ? `مجموع ${number(scope.rooms)} اتاق برای ${number(scope.nights)} شب`
        : `Total for ${number(scope.rooms)} rooms, ${number(scope.nights)} nights`;
  return (
    <div
      className={styles.price}
      {...languageProps(language)}
      role="group"
      aria-label={`${label}: ${amount} ${unit}`}
    >
      <div aria-hidden="true" className={styles.amount}>
        <bdi data-price-band={band}>{amount}</bdi>
        <span className={styles.unit}>{unit}</span>
      </div>
      <span aria-hidden="true" className={styles.description}>
        {label}
      </span>
    </div>
  );
}
