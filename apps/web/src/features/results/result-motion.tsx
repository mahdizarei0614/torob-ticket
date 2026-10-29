import { forwardRef, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useAnimationControls, useIsPresent, usePresence } from 'motion/react';
import { LoadingSkeleton, useMotionPolicy } from '@torob-ticket/ui';
import styles from './results.module.css';

/** Retained exits are decorative immediately; their old quote controls cannot receive input. */
export const ResultPresence = forwardRef<HTMLDivElement, { children: ReactNode; className?: string; role?: string; label?: string; collapse?: boolean; layout?: boolean; layoutDependency?: string; staticMotion?: boolean; refreshKey?: string }>(function ResultPresence({ children, className, role, label, collapse = false, layout = false, layoutDependency, staticMotion = false, refreshKey }, ref) {
 const present = useIsPresent();
 const [, safeToRemove] = usePresence();
 const policy = useMotionPolicy();
 const animated = policy.enabled && !staticMotion;
 const controls = useAnimationControls(), entered = useRef(false), entryComplete = useRef(false);
 const previousRefresh = useRef(refreshKey);
 useLayoutEffect(() => {
  controls.stop();
  let cancelled = false;
  if (!present) {
   const exitFrame = { opacity: 0, y: animated && !collapse ? -5 : 0, ...(collapse ? { height: 0 } : {}) };
   if (!animated) controls.set(exitFrame);
   else {
    const complete = () => { if (!cancelled) safeToRemove?.(); };
    void controls.start({ ...exitFrame, transition: { duration: .28, ease: [.22, .68, .24, 1] } }).then(complete, complete);
   }
   return () => { cancelled = true; controls.stop(); };
  }
  const fresh = !entered.current; entered.current = true;
  const refreshed = previousRefresh.current !== refreshKey; previousRefresh.current = refreshKey;
  const finalFrame = { opacity: 1, y: 0, ...(collapse ? { height: 'auto' } : {}) };
  if (!animated || !fresh && !refreshed && entryComplete.current) {
   entryComplete.current = true;
   controls.set(finalFrame);
  }
  else {
   // A StrictMode effect replay interrupts the first attempt. Resume that
   // unfinished entry from its current frame instead of snapping height:auto.
   entryComplete.current = false;
   if (fresh || refreshed) controls.set({ opacity: fresh ? 0 : .72, y: collapse || !fresh ? 0 : 12, ...(collapse ? { height: fresh ? 0 : 'auto' } : {}) });
   const complete = () => { if (!cancelled) entryComplete.current = true; };
   void controls.start({ ...finalFrame, transition: { duration: .28, ease: [.22, .68, .24, 1] } }).then(complete, complete);
  }
  return () => { cancelled = true; controls.stop(); };
 }, [controls, animated, present, collapse, safeToRemove, refreshKey]);
 // Presence registrations finish in passive effects; acknowledge static retirement afterward.
 useEffect(() => { if (!present && !animated) safeToRemove?.(); }, [present, animated, safeToRemove]);
 return <motion.div ref={ref} className={className} role={role} aria-label={label} inert={!present || undefined} aria-hidden={!present || undefined} data-result-presence={present ? 'current' : 'exiting'} data-result-motion={animated ? 'finite' : 'static'}
  layout={animated && layout ? 'position' : false}
  layoutDependency={layoutDependency}
  initial={false} animate={controls}
  transition={{ duration: animated ? .28 : 0, ease: [.22, .68, .24, 1], layout: { duration: animated ? .36 : 0, ease: [.22, .68, .24, 1] } }}
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
