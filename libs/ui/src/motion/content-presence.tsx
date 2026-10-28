import { AnimatePresence, motion, useAnimationControls, usePresence } from 'motion/react';
import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { useMotionPolicy } from './motion-surface';

/** Retained exit visuals become inert immediately; the live owner keeps all actions. */
export function ContentItem({ children, className, layout = false }: { children: ReactNode; className?: string; layout?: boolean }) {
  const policy = useMotionPolicy();
  const controls = useAnimationControls();
  const [present, remove] = usePresence();
  useLayoutEffect(() => {
    let current = true;
    controls.stop();
    const frame = { opacity: present ? 1 : 0, y: present || !policy.enabled ? 0 : -6 };
    if (!policy.enabled) controls.set(frame);
    else void controls.start({ ...frame, transition: { duration: .28, ease: 'easeOut' } }).then(() => { if (current && !present) remove?.(); });
    return () => { current = false; controls.stop(); };
  }, [controls, present, policy.enabled, remove]);
  // Presence registers in passive effects; acknowledge a static exit after that registration.
  useEffect(() => { if (!present && !policy.enabled) remove?.(); }, [present, policy.enabled, remove]);
  return <motion.div className={className} data-content-presence={present ? 'present' : 'exiting'} inert={!present} aria-hidden={!present || undefined}
    initial={policy.enabled ? { opacity: 0, y: 10 } : false} animate={controls}
    layout={policy.enabled && layout ? 'position' : false}
    transition={{ duration: policy.enabled ? .28 : 0, ease: 'easeOut', layout: { duration: policy.enabled ? .34 : 0 } }}>
    {children}
  </motion.div>;
}

/** Use a semantic identity, never a render counter, so unchanged data keeps focus. */
export function ContentSwap({ children, identity, className }: { children: ReactNode; identity: string; className?: string }) {
  return <AnimatePresence initial={false} mode="wait"><ContentItem key={identity} className={className}>{children}</ContentItem></AnimatePresence>;
}
