import { useRef, type ReactNode } from 'react';
import { useMotionPolicy, type PriceBand } from '@torob-ticket/ui';
import styles from './dates.module.css';

/** A finite entry when a price arrives; coverage changes never replay an existing amount. */
export function DateAmount({ band, children }: { band: PriceBand; children: ReactNode }) {
  const policy = useMotionPolicy();
  const entry = useRef(policy.enabled);
  if (!policy.enabled) entry.current = false;
  return <small className={styles.priceAmount} data-price-band={band} data-enter={entry.current && policy.enabled && band !== 'unknown' || undefined}>{children}</small>;
}
