import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './route-presentation.module.css';

export interface EndpointSnapshot {
  key: string; id: string; name: string; role: 'origin' | 'destination'; arrived: boolean;
  left: number; top: number; opacity: number; text: CSSProperties;
}
export function endpointEdgeOpacity(x: number, y: number, width: number, height: number) {
  const t = Math.max(0, Math.min(1, Math.min(x, y, width - x, height - y) / 42));
  return t * t * (3 - 2 * t);
}

/** Only selected endpoints are live. At most four decorative exits retain their last screen placement. */
export function EndpointPresence({ endpoints, reducedMotion }: { endpoints: readonly EndpointSnapshot[]; reducedMotion: boolean }) {
  const previous = useRef(endpoints);
  const [exiting, setExiting] = useState<readonly EndpointSnapshot[]>([]);
  useLayoutEffect(() => {
    const keys = new Set(endpoints.map(endpoint => endpoint.key));
    const removed = previous.current.filter(endpoint => !keys.has(endpoint.key));
    if (reducedMotion) setExiting(old => old.length ? [] : old);
    else if (removed.length) setExiting(old => [...old.filter(endpoint => !keys.has(endpoint.key) && !removed.some(item => item.key === endpoint.key)), ...removed].slice(-4));
    previous.current = endpoints;
  }, [endpoints, reducedMotion]);
  const liveKeys = new Set(endpoints.map(endpoint => endpoint.key));
  const visual = (endpoint: EndpointSnapshot, ghost: boolean) => <div
    key={`${ghost ? 'exit' : 'live'}:${endpoint.key}`}
    className={styles.endpoint}
    aria-hidden={ghost || endpoint.opacity === 0 || undefined}
    data-endpoint-ghost={ghost || undefined}
    data-endpoint-role={endpoint.role}
    data-exiting-city-id={ghost ? endpoint.id : undefined}
    data-route-endpoint={ghost ? undefined : endpoint.role}
    data-journey-endpoint={ghost ? undefined : endpoint.role}
    data-city-id={ghost ? undefined : endpoint.id}
    data-arrived={endpoint.arrived}
    data-endpoint-opacity={endpoint.opacity.toFixed(3)}
    style={{ left: endpoint.left, top: endpoint.top, opacity: endpoint.opacity }}
  >
    <div className={ghost ? styles.endpointExit : styles.endpointEnter} onAnimationEnd={ghost ? event => { if (event.currentTarget === event.target) setExiting(old => old.filter(item => item.key !== endpoint.key)); } : undefined}>
      <span className={styles.orbit} aria-hidden="true" />
      <div className={styles.endpointText} style={endpoint.text} dir="rtl"><small>{endpoint.role === 'origin' ? 'مبدأ' : 'مقصد'}</small><strong>{endpoint.name}</strong></div>
    </div>
  </div>;
  return <>{!reducedMotion && exiting.filter(endpoint => !liveKeys.has(endpoint.key)).map(endpoint => visual(endpoint, true))}{endpoints.map(endpoint => visual(endpoint, false))}</>;
}
