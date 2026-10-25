import { Component, createContext, lazy, Suspense, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { GraphicsStatus } from './context-lifecycle';
import type { GraphicsQuality } from './quality-policy';
import styles from './graphics.module.css';
const Renderer = lazy(() => import('./shared-renderer'));
export interface GraphicsViewRegistration {
  id: string;
  element: HTMLElement;
  track: RefObject<HTMLElement>;
  scene: ReactNode;
  visible: boolean;
}
export interface GraphicsDiagnostics {
  status: GraphicsStatus;
  frames: number;
  themeFrames: number;
  renderer: string;
  version: string;
  quality: GraphicsQuality;
  cpuSubmissionMs: number[];
  programs: { linked: boolean; vertexCompiled: boolean; fragmentCompiled: boolean; programLog: string; vertexLog: string; fragmentLog: string }[];
  pixels: Record<string, number[]>;
  uniforms: Record<string, number[]>;
  geometries: number;
  programsInMemory: number;
  activeViews: number;
  frameSubscribers: number;
  lost: number;
  restored: number;
  disposed: boolean;
}
export interface GraphicsController {
  invalidate: () => void;
  inspect: () => GraphicsDiagnostics | null;
}
interface HostContext extends GraphicsController {
  status: GraphicsStatus;
  labelLayer: HTMLElement | null;
  register: (view: GraphicsViewRegistration) => () => void;
}
const Context = createContext<HostContext | null>(null);
export function useGraphics() {
  const host = useContext(Context);
  if (!host) throw new Error('GraphicsView requires GraphicsProvider');
  return host;
}
class RendererBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onFailure(); }
  override render() { return this.state.failed ? null : this.props.children; }
}
/** One host per application. Semantic DOM remains mounted for every renderer state. */
export function GraphicsProvider({ children, covered = false, motion = false, diagnostics = false, controllerRef }: {
  children: ReactNode;
  covered?: boolean;
  motion?: boolean;
  diagnostics?: boolean;
  controllerRef?: RefObject<GraphicsController | null>;
}) {
  const [status, setStatus] = useState<GraphicsStatus>('loading');
  const [labelLayer,setLabelLayer]=useState<HTMLDivElement|null>(null);
  const [views, setViews] = useState<GraphicsViewRegistration[]>([]);
  const eventSource = useRef<HTMLDivElement>(null);
  const runtime = useRef<GraphicsController>({ invalidate() { /* Lazy renderer not yet attached. */ }, inspect: () => null });
  const register = useCallback((view: GraphicsViewRegistration) => {
    setViews(current => [...current.filter(item => item.id !== view.id), view]);
    return () => setViews(current => current.filter(item => item !== view));
  }, []);
  const invalidate = useCallback(() => runtime.current.invalidate(), []);
  const inspect = useCallback(() => runtime.current.inspect(), []);
  const context = useMemo(() => ({ status, labelLayer, register, invalidate, inspect }), [status, labelLayer, register, invalidate, inspect]);
  if (controllerRef) controllerRef.current = { invalidate, inspect };
  return <Context.Provider value={context}>
    <div ref={eventSource} className={styles.host} data-graphics-status={status}>
      {children}
      <div ref={setLabelLayer} className={styles.labelLayer} data-graphics-label-layer />
      <RendererBoundary onFailure={() => setStatus('unavailable')}>
        <Suspense fallback={null}>
          <Renderer views={views} eventSource={eventSource} runtime={runtime} onStatus={setStatus} covered={covered} motion={motion} diagnostics={diagnostics} />
        </Suspense>
      </RendererBoundary>
    </div>
  </Context.Provider>;
}
