import { forwardRef, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useAnimationControls, useIsPresent, usePresence } from 'motion/react';
import { LoadingSkeleton, useMotionPolicy } from '@torob-ticket/ui';
import styles from './results.module.css';

/** Retained exits are decorative immediately; their old quote controls cannot receive input. */
export const ResultPresence = forwardRef<HTMLDivElement, { children: ReactNode; className?: string; role?: string; label?: string; collapse?: boolean; layout?: boolean }>(function ResultPresence({ children, className, role, label, collapse = false, layout = false }, ref) {
 const present = useIsPresent();
 const [, safeToRemove] = usePresence();
 const policy = useMotionPolicy();
 const controls = useAnimationControls(), entered = useRef(false);
 useLayoutEffect(() => {
  controls.stop();
  let cancelled = false;
  if (!present) {
   const exitFrame = { opacity: 0, y: policy.enabled ? -5 : 0, ...(collapse ? { height: 0 } : {}) };
   if (!policy.enabled) controls.set(exitFrame);
   else {
    const complete = () => { if (!cancelled) safeToRemove?.(); };
    void controls.start({ ...exitFrame, transition: { duration: .28, ease: [.22, .68, .24, 1] } }).then(complete, complete);
   }
   return () => { cancelled = true; controls.stop(); };
  }
  const fresh = !entered.current; entered.current = true;
  const finalFrame = { opacity: 1, y: 0, ...(collapse ? { height: 'auto' } : {}) };
  if (!policy.enabled || !fresh) controls.set(finalFrame);
  else {
   controls.set({ opacity: 0, y: 12, ...(collapse ? { height: 0 } : {}) });
   void controls.start({ ...finalFrame, transition: { duration: .28, ease: [.22, .68, .24, 1] } });
  }
  return () => controls.stop();
 }, [controls, policy.enabled, present, collapse, safeToRemove]);
 // Presence registrations finish in passive effects; acknowledge static retirement afterward.
 useEffect(() => { if (!present && !policy.enabled) safeToRemove?.(); }, [present, policy.enabled, safeToRemove]);
 return <motion.div ref={ref} className={className} role={role} aria-label={label} inert={!present || undefined} aria-hidden={!present || undefined} data-result-presence={present ? 'current' : 'exiting'} data-result-motion={policy.enabled ? 'finite' : 'static'}
  layout={policy.enabled && layout ? 'position' : false}
  initial={false} animate={controls}
  transition={{ duration: policy.enabled ? .28 : 0, ease: [.22, .68, .24, 1], layout: { duration: policy.enabled ? .36 : 0, ease: [.22, .68, .24, 1] } }}
  style={!present ? { pointerEvents: 'none' } : undefined}>{children}</motion.div>;
});

export function ResultsPresence({ children, pop = false }: { children: ReactNode; pop?: boolean }) {
 return <AnimatePresence initial={false} mode={pop ? 'popLayout' : 'sync'}>{children}</AnimatePresence>;
}

/** Three compact rows reserve useful result space while providers are collecting. */
export function ResultsSkeleton() {
 const policy = useMotionPolicy();
 return <div className={styles.skeletons} role="status" aria-label="در حال دریافت پیشنهادهای فروشندگان" aria-busy="true" data-results-skeleton data-motion-policy={policy.enabled ? 'finite' : 'static'}>
  <span className={styles.srOnly}>در حال دریافت پیشنهادهای فروشندگان…</span>
  <LoadingSkeleton rows={3} compact/>
 </div>;
}
