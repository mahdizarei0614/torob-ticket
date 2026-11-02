import { useRef, type ReactNode } from 'react';
import { useMotionPolicy, type PriceBand } from '@torob-ticket/ui';
import { AnimatePresence } from 'motion/react';
import { DateLoadingVisual } from './date-loading-visual';
import styles from './dates.module.css';

/** A finite entry when a price arrives; coverage changes never replay an existing amount. */
export function DateAmount({ band, children, pending, motionEnabled = true }: { band: PriceBand; children: ReactNode; pending?: boolean; motionEnabled?: boolean }) {
  const policy = useMotionPolicy({ disabled: !motionEnabled });
  const entry = useRef(policy.enabled);
  if (!policy.enabled) entry.current = false;
  return <small className={styles.priceAmount} data-price-band={band} data-date-amount-state={pending === undefined ? undefined : pending ? 'loading' : 'ready'} data-enter={pending === undefined && entry.current && policy.enabled && band !== 'unknown' || undefined}>
    {pending === undefined ? children : <AnimatePresence><DateLoadingVisual key={pending ? 'checking' : 'value'} identity={typeof children === 'string' ? children : undefined} className={styles.amountVisual} loading={pending} motionEnabled={motionEnabled} band={pending ? 'unknown' : band}>{children}</DateLoadingVisual></AnimatePresence>}
  </small>;
}
