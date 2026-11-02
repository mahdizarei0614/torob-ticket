import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion, useAnimationControls, usePresence } from 'motion/react';
import { useMotionPolicy, type PriceBand } from '@torob-ticket/ui';
import styles from './dates.module.css';

/** One finite retained visual. Authority changes immediately; only its pixels retire. */
export function DateLoadingVisual({ children, className, loading = false, block = false, motionEnabled = true, band, identity }: { children: ReactNode; className?: string; loading?: boolean; block?: boolean; motionEnabled?: boolean; band?: PriceBand; identity?: string }) {
  const [present, remove] = usePresence();
  const policy = useMotionPolicy({ disabled: !motionEnabled });
  const controls = useAnimationControls();
  const previousIdentity = useRef(identity);
  useLayoutEffect(() => {
    let current = true;
    controls.stop();
    const changed = previousIdentity.current !== identity;
    previousIdentity.current = identity;
    const frame = { opacity: present ? 1 : 0 };
    if (!policy.enabled) controls.set(frame);
    else {
      if (present && changed) controls.set({ opacity: 0 });
      void controls.start({ ...frame, transition: { duration: .24, ease: 'easeInOut' } }).then(() => { if (current && !present) remove?.(); });
    }
    return () => { current = false; controls.stop(); };
  }, [controls, present, policy.enabled, remove, identity]);
  // Presence registration is passive; static exits also acknowledge it there.
  useEffect(() => { if (!present && !policy.enabled) remove?.(); }, [present, policy.enabled, remove]);
  const Element = block ? motion.div : motion.span;
  return <Element className={className} inert={!present} aria-hidden={!present || undefined}
    data-date-loading-stage={loading ? present ? 'loading' : 'exiting' : undefined}
    data-date-value-stage={!loading ? present ? 'ready' : 'exiting' : undefined}
    initial={policy.enabled ? { opacity: 0 } : false} animate={controls}>
    <span className={loading ? styles.loadingPulse : undefined} data-loading-pulse={loading || undefined} data-animate={loading && policy.enabled || undefined} data-price-band={band}>{children}</span>
  </Element>;
}
