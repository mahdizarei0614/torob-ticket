import { Activity, memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { View } from '@react-three/drei/web/View';
import { NoToneMapping, SRGBColorSpace, WebGLRenderer } from 'three';
import { useTheme } from '@torob-ticket/ui';
import { observeContextLifecycle, type GraphicsStatus } from './context-lifecycle';
import { createRenderScheduler } from './render-scheduler';
import { chooseGraphicsQuality } from './quality-policy';
import type { GraphicsController, GraphicsDiagnostics, GraphicsViewRegistration } from './graphics-provider';
import styles from './graphics.module.css';
interface RendererProps {
  views: GraphicsViewRegistration[];
  eventSource: RefObject<HTMLDivElement | null>;
  runtime: RefObject<GraphicsController>;
  onStatus: (status: GraphicsStatus) => void;
  covered: boolean;
  motion: boolean;
  diagnostics: boolean;
}
function inViewport(view: GraphicsViewRegistration) {
  const rect = view.element.getBoundingClientRect();
  return view.visible && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
}
function Driver(props: RendererProps & { onVisibility: (ids: string[]) => void; sceneInvalidation: RefObject<() => void>; onDpr: (dpr: number) => void }) {
  const gl = useThree(value => value.gl);
  const getState = useThree(value => value.get);
  const { themeBridge } = useTheme();
  const latest = useRef(props);
  latest.current = props;
  const wake = useRef(() => { /* Initialized in layout effect. */ });
  useLayoutEffect(() => {
    const state = getState();
    const context = gl.getContext() as WebGL2RenderingContext;
    let live = true;
    let lost = false;
    let failed = false;
    let ready = false;
    let stickyLow = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const initialQuality = chooseGraphicsQuality({ deviceDpr: devicePixelRatio, mobile: innerWidth <= 600, samples: [] });
    const info = context.getExtension('WEBGL_debug_renderer_info');
    const data: GraphicsDiagnostics = {
      status: 'loading', frames: 0, themeFrames: 0,
      renderer: String(context.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER)),
      version: String(context.getParameter(context.VERSION)), quality: initialQuality,
      cpuSubmissionMs: [], programs: [], pixels: {}, uniforms: {}, geometries: 0, programsInMemory: 0, activeViews: 0, frameSubscribers: 0,
      lost: 0, restored: 0, disposed: false,
    };
    const status = (value: GraphicsStatus) => { if (!live) return; data.status = value; latest.current.onStatus(value); };
    const readPrograms = () => (gl.info.programs ?? []).map(program => ({
      linked: Boolean(context.getProgramParameter(program.program as WebGLProgram, context.LINK_STATUS)),
      vertexCompiled: Boolean(context.getShaderParameter(program.vertexShader, context.COMPILE_STATUS)),
      fragmentCompiled: Boolean(context.getShaderParameter(program.fragmentShader, context.COMPILE_STATUS)),
      programLog: context.getProgramInfoLog(program.program as WebGLProgram) ?? '',
      vertexLog: context.getShaderInfoLog(program.vertexShader) ?? '',
      fragmentLog: context.getShaderInfoLog(program.fragmentShader) ?? '',
    }));
    const clear = () => { gl.setScissorTest(false); gl.setViewport(0, 0, innerWidth, innerHeight); gl.clear(true, true, true); };
    const active = () => live && !lost && !failed && !document.hidden && !latest.current.covered;
    const scheduler = createRenderScheduler(time => {
      if (!active()) return;
      const start = performance.now();
      clear();
      state.advance(time / 1000, false);
      data.frames++;
      data.frameSubscribers = state.get().internal.subscribers.length;
      data.activeViews = latest.current.views.filter(inViewport).length;
      data.geometries = gl.info.memory.geometries;
      data.programsInMemory = gl.info.programs?.length ?? 0;
      if (!ready && data.programsInMemory > 0 && !failed) { ready = true; status('ready'); }
      const elapsed = performance.now() - start;
      if (latest.current.diagnostics) {
        data.programs = readPrograms();
        const program = gl.info.programs?.[0]?.program as WebGLProgram | undefined;
        if (program) for (const key of Object.keys(themeBridge.getSnapshot()?.colors ?? {})) {
          const location = context.getUniformLocation(program, key);
          if (location) data.uniforms[key] = [...context.getUniform(program, location) as Float32Array];
        }
        for (const view of latest.current.views.filter(inViewport)) {
          const rect = view.element.getBoundingClientRect();
          const pixel = new Uint8Array(4);
          const dpr = gl.getPixelRatio();
          // Left quarter is the shader's flat background diagnostic region.
          const x = Math.floor((rect.left + rect.width * 0.25) * dpr);
          const y = Math.floor((innerHeight - rect.top - rect.height * 0.5) * dpr);
          context.readPixels(x, y, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
          data.pixels[view.element.getAttribute('aria-label') ?? view.id] = [...pixel];
        }
        const pixel = new Uint8Array(4);
        context.readPixels(1, 1, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
        data.pixels['outside'] = [...pixel];
      }
      data.cpuSubmissionMs.push(elapsed);
      if (data.cpuSubmissionMs.length > 30) data.cpuSubmissionMs.shift();
      const quality = chooseGraphicsQuality({ deviceDpr: devicePixelRatio, mobile: innerWidth <= 600, samples: data.cpuSubmissionMs });
      stickyLow ||= quality.tier === 'low';
      if (stickyLow) { quality.dpr = Math.min(1, devicePixelRatio); quality.tier = 'low'; quality.reason = 'measured-cpu-submission'; }
      if (gl.getPixelRatio() !== quality.dpr) { state.setDpr(quality.dpr); latest.current.onDpr(quality.dpr); scheduler.invalidate(); }
      data.quality = quality;
    });
    const updatePolicy = () => {
      const visibleViews = latest.current.views.filter(inViewport);
      const visible = visibleViews.length > 0;
      data.activeViews = active() ? visibleViews.length : 0;
      latest.current.onVisibility(active() ? visibleViews.map(view => view.id) : []);
      scheduler.setPolicy({ active: active() && visible, motion: latest.current.motion, reducedMotion: reduced.matches });
      if (active() && !visible) clear();
    };
    wake.current = updatePolicy;
    const requestSceneFrame = () => { if (active()) scheduler.invalidateScene(); };
    const previousInvalidation = getState().invalidate;
    props.sceneInvalidation.current = requestSceneFrame;
    // Public store setter: reconciler prop commits and useThree().invalidate use
    // this bridge even though the renderer itself is manually advanced.
    state.set({ invalidate: requestSceneFrame });
    const stopContext = observeContextLifecycle(gl.domElement, () => {
      lost = true; ready = false; data.lost++; status('context-lost'); updatePolicy();
    }, () => {
      lost = false; failed = false; ready = false; data.restored++; status('loading'); updatePolicy();
    });
    gl.debug.checkShaderErrors = true;
    gl.debug.onShaderError = (raw, program, vertex, fragment) => {
      failed = true;
      data.programs = [{ linked: false, vertexCompiled: Boolean(raw.getShaderParameter(vertex, raw.COMPILE_STATUS)), fragmentCompiled: Boolean(raw.getShaderParameter(fragment, raw.COMPILE_STATUS)), programLog: raw.getProgramInfoLog(program) ?? '', vertexLog: raw.getShaderInfoLog(vertex) ?? '', fragmentLog: raw.getShaderInfoLog(fragment) ?? '' }];
      status('shader-error');
      updatePolicy();
    };
    let flushedTheme: ReturnType<typeof themeBridge.getSnapshot> = null;
    const flushTheme = () => {
      const theme=themeBridge.getSnapshot();
      if(theme===flushedTheme)return Promise.resolve();
      updatePolicy();
      const previous = data.frames;
      // Synchronous beforePaint subscribers already update every material. Avoid a second identical frame
      // when the application awaits this same bridge publication through onThemeApplied.
      if(theme!==flushedTheme)scheduler.flush();
      if (data.frames !== previous) {data.themeFrames++;flushedTheme=theme;}
      return Promise.resolve();
    };
    const unsubscribe = themeBridge.beforePaint(() => {void flushTheme();});
    const runtime: GraphicsController = { invalidate: updatePolicy, flushTheme, inspect: () => ({ ...structuredClone(data), frameSubscribers: state.get().internal.subscribers.length }) };
    props.runtime.current = runtime;
    document.addEventListener('visibilitychange', updatePolicy);
    window.addEventListener('scroll', updatePolicy, true);
    window.addEventListener('resize', updatePolicy);
    reduced.addEventListener('change', updatePolicy);
    let dprQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    const dprChanged = () => {
      dprQuery.removeEventListener('change', dprChanged);
      dprQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
      dprQuery.addEventListener('change', dprChanged);
      const dpr = Math.min(devicePixelRatio, stickyLow ? 1 : innerWidth <= 600 ? 1.5 : 1.75);
      state.setDpr(dpr);
      latest.current.onDpr(dpr);
      updatePolicy();
    };
    dprQuery.addEventListener('change', dprChanged);
    updatePolicy();
    return () => {
      live = false;
      scheduler.dispose();
      if (getState().invalidate === requestSceneFrame) state.set({ invalidate: previousInvalidation });
      if (props.sceneInvalidation.current === requestSceneFrame) props.sceneInvalidation.current = () => {};
      unsubscribe(); stopContext();
      document.removeEventListener('visibilitychange', updatePolicy);
      window.removeEventListener('scroll', updatePolicy, true);
      window.removeEventListener('resize', updatePolicy);
      reduced.removeEventListener('change', updatePolicy);
      dprQuery.removeEventListener('change', dprChanged);
      gl.debug.onShaderError = null;
      data.disposed = true;
      data.frameSubscribers = 0;
      if (props.runtime.current === runtime) props.runtime.current = { invalidate() { /* Host unmounted. */ }, flushTheme: () => Promise.resolve(), inspect: () => structuredClone(data) };
      // R3F owns renderer disposal, event disconnection and context release on Canvas unmount.
    };
  }, [gl, getState, themeBridge, props.runtime, props.sceneInvalidation]);
  useEffect(() => {
    const observer = new ResizeObserver(() => wake.current());
    const intersections = new IntersectionObserver(() => wake.current());
    for (const view of props.views) { observer.observe(view.element); intersections.observe(view.element); }
    wake.current();
    return () => { observer.disconnect(); intersections.disconnect(); };
  }, [props.views, props.covered, props.motion]);
  return null;
}
function SceneInvalidation({ active, connection }: { active: boolean; connection: RefObject<() => void> }) {
  const get = useThree(state => state.get);
  const set = useThree(state => state.set);
  const enabled = useRef(active);
  enabled.current = active;
  useLayoutEffect(() => {
    let live = true;
    const previous = get().invalidate;
    const invalidate = () => { if (live && enabled.current) connection.current(); };
    // Drei portals preserve their own store methods. Install at the actual scene
    // boundary, outside Activity so hidden scenes retain a guarded stable method.
    set({ invalidate });
    return () => {
      live = false;
      if (get().invalidate === invalidate) set({ invalidate: previous });
    };
  }, [get, set, connection]);
  return null;
}
function SceneCommit({ runtime }: { runtime: RefObject<GraphicsController> }) {
  // Activity reveals commit in the R3F reconciler after the DOM host update. Paint the
  // committed scene, never rely on a frame scheduled before its subscriptions existed.
  useLayoutEffect(() => runtime.current.invalidate(), [runtime]);
  return null;
}
function SharedRenderer(props: RendererProps) {
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [dpr, setDpr] = useState(() => chooseGraphicsQuality({ deviceDpr: devicePixelRatio, mobile: innerWidth <= 600, samples: [] }).dpr);
  const sceneInvalidation = useRef<() => void>(() => {});
  useEffect(() => props.runtime.current.invalidate(), [activeIds, props.runtime]);
  const onVisibility = useCallback((ids: string[]) => setActiveIds(current => current.length === ids.length && current.every((id, index) => id === ids[index]) ? current : ids), []);
  return <Canvas data-active-scenes={activeIds.length} className={styles.canvas} aria-hidden="true" tabIndex={-1} frameloop="never" eventSource={props.eventSource}
    dpr={dpr}
    gl={defaults => {
      const canvas = defaults.canvas as HTMLCanvasElement;
      const context = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true });
      if (!context) throw new Error('WebGL2 unavailable');
      const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: false });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = NoToneMapping;
      renderer.setClearAlpha(0);
      return renderer;
    }}>
    <Driver {...props} onVisibility={onVisibility} sceneInvalidation={sceneInvalidation} onDpr={setDpr} />
    {props.views.map((view, index) => <View key={view.id} track={view.track} visible={activeIds.includes(view.id)} index={index + 1}><SceneInvalidation active={activeIds.includes(view.id)} connection={sceneInvalidation} /><Activity mode={activeIds.includes(view.id) ? 'visible' : 'hidden'}>{view.scene}<SceneCommit runtime={props.runtime} /></Activity></View>)}
  </Canvas>;
}

export default memo(SharedRenderer);
