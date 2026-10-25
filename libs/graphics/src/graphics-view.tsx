import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useGraphics } from './graphics-provider';
import styles from './graphics.module.css';
/**
 * Children are arbitrary R3F scene nodes. All controls and labels belong in semantic DOM.
 * Declarative prop commits render automatically. For imperative scene changes use
 * useThree(state => state.invalidate); the global R3F invalidate fan-out bypasses
 * this manually advanced host. Scene animation still requires the host motion policy.
 */
export function GraphicsView({ children, fallback, label, visible = true, className }: {
  children: ReactNode;
  fallback: ReactNode;
  label: string;
  visible?: boolean;
  className?: string;
}) {
  const id = useId();
  const element = useRef<HTMLDivElement>(null);
  const { status, register } = useGraphics();
  useLayoutEffect(() => {
    if (!element.current) return;
    return register({ id, element: element.current, track: { current: element.current }, scene: children, visible });
  }, [id, children, visible, register]);
  return <div ref={element} aria-label={label} role="img" data-graphics-view={id} data-fallback={status !== 'ready'} hidden={!visible} className={`${styles.view} ${className ?? ''}`}>
    <div className={styles.fallback} aria-hidden={status === 'ready'} inert={status === 'ready'}>{fallback}</div>
  </div>;
}
