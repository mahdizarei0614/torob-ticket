import { useMotionPolicy } from '../motion/motion-surface';
import styles from '../styles/loading-skeleton.module.css';

/** Decorative reserved space: the enclosing status supplies the loading announcement. */
export function LoadingSkeleton({ rows = 2, compact = false }: { rows?: number; compact?: boolean }) {
  const policy = useMotionPolicy();
  return <div aria-hidden="true" className={styles.skeleton} data-loading-skeleton data-compact={compact || undefined} data-animate={policy.enabled || undefined}>
    {Array.from({ length: Math.min(4, Math.max(1, rows)) }, (_, index) => <div className={styles.card} key={index}><span /><span /><span /></div>)}
  </div>;
}
