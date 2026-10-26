import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import {runThemeTransition,type ThemeTransitionRun} from './theme-transition';
import { I18nProvider } from 'react-aria-components';
import { type Mode } from '@torob-ticket/contracts';
import { languageProps, type Language } from '../components/language';
import styles from '../styles/primitives.module.css';
export type Appearance = 'light' | 'dark';
export type ThemePreference = Appearance | 'system';
export interface ThemeColors {
  background: string;
  dot: string;
  route: string;
  routeMuted: string;
  highlight: string;
  chartLine: string;
  chartGrid: string;
  chartMarker: string;
  focus: string;
}
export interface ThemeSnapshot {
  appearance: Appearance;
  mode: Mode;
  colors: ThemeColors;
}
export interface ThemeBridge {
  getSnapshot: () => ThemeSnapshot | null;
  beforePaint: (listener: (theme: ThemeSnapshot) => void) => () => void;
  subscribe: (listener: (theme: ThemeSnapshot) => void) => () => void;
}
export interface ThemeContextValue {
  themeBridge: ThemeBridge;
  appearance: Appearance;
  preference: ThemePreference;
  mode: Mode;
  language: Language;
  setPreference: (preference: ThemePreference, origin?: HTMLElement) => void;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);
const storageKey = 'torobticket.appearance';
function systemAppearance(): Appearance {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
function savedPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* Optional browser persistence. */
  }
  return 'system';
}
export function readThemeColors(element: Element = document.documentElement): ThemeColors {
  const css = getComputedStyle(element);
  const read = (token: string) => css.getPropertyValue(token).trim();
  return {
    background: read('--scene-background'),
    dot: read('--scene-dot'),
    route: read('--scene-route'),
    routeMuted: read('--scene-route-muted'),
    highlight: read('--scene-highlight'),
    chartLine: read('--chart-line'),
    chartGrid: read('--chart-grid'),
    chartMarker: read('--chart-marker'),
    focus: read('--focus'),
  };
}
/** One root provider per application. The synchronous bridge lets graphics update before a transition frame. */
export function ThemeProvider({
  children,
  mode = 'flight',
  language = 'fa',
  variant = 'consumer',
  initialPreference,
  onThemeChange,
  onThemeApplied,
  active=true,
}: {
  children: ReactNode;
  mode?: Mode;
  language?: Language;
  variant?: 'consumer' | 'admin';
  initialPreference?: ThemePreference;
  onThemeChange?: (theme: ThemeSnapshot) => void;
  /** Application seam: resolves after visible graphics have flushed the resolved tokens. */
  onThemeApplied?: () => Promise<void>;
  /** Retained offscreen trees keep context; only the visible owner publishes global tokens. */
  active?: boolean;
}) {
  const [preference, setStoredPreference] = useState<ThemePreference>(
    () => initialPreference ?? savedPreference(),
  );
  const [appearance, setAppearance] = useState<Appearance>(() =>
    preference === 'system' ? systemAppearance() : preference,
  );
  const snapshot = useRef<ThemeSnapshot | null>(null);
  const paintSubscribers = useRef(new Set<(theme: ThemeSnapshot) => void>());
  const subscribers = useRef(new Set<(theme: ThemeSnapshot) => void>());
  const [themeBridge] = useState<ThemeBridge>(() => ({
    getSnapshot: () => snapshot.current,
    beforePaint: listener => { paintSubscribers.current.add(listener); return () => { paintSubscribers.current.delete(listener); }; },
    subscribe: listener => { subscribers.current.add(listener); return () => { subscribers.current.delete(listener); }; },
  }));
  const bridge = useRef(onThemeChange);
  bridge.current = onThemeChange;
  const activeTransition = useRef<ThemeTransitionRun | null>(null);
  const requestGeneration = useRef(0);
  const rootActive=useRef(active);rootActive.current=active;
  const activeMode = variant === 'admin' ? 'flight' : mode;
  const currentMode=useRef(activeMode);currentMode.current=activeMode;
  const target=useRef({preference,appearance});
  const applied=useRef(onThemeApplied);applied.current=onThemeApplied;
  const publish=useCallback((next:typeof target.current,nextMode:Mode)=>{
    const root=document.documentElement;
    root.dataset.appearance=next.appearance;root.dataset.preference=next.preference;root.dataset.mode=nextMode;root.style.colorScheme=next.appearance;
    const theme={appearance:next.appearance,mode:nextMode,colors:readThemeColors(root)};
    snapshot.current=theme;
    for(const listener of subscribers.current)listener(theme);
    for(const listener of paintSubscribers.current)listener(theme);
    bridge.current?.(theme);
  },[]);
  const change=useCallback((next:typeof target.current,nextMode:Mode,origin?:HTMLElement,inLayout=false,animate=true)=>{
    const generation=++requestGeneration.current;
    activeTransition.current?.skip();
    const isCurrent=()=>rootActive.current&&generation===requestGeneration.current;
    const update=()=>{
      if(!isCurrent())return;
      const state=()=>{setStoredPreference(next.preference);setAppearance(next.appearance);};
      // A direct layout-effect update is already before paint; deferred native callbacks need flushSync.
      if(inLayout)state();else flushSync(state);
      publish(next,nextMode);
    };
    activeTransition.current=runThemeTransition(update,{origin,isCurrent,animate,onApplied:()=>applied.current?.()??Promise.resolve()});
    inLayout=false;
  },[publish]);
  const previousOwner=useRef<{active:boolean;mode:Mode}|null>(null);
  useLayoutEffect(()=>{
    rootActive.current=active;
    const previous=previousOwner.current;previousOwner.current={active,mode:activeMode};
    if(!active){requestGeneration.current++;activeTransition.current?.skip();activeTransition.current=null;return;}
    if(!previous?.active){
      if(target.current.preference==='system')target.current={preference:'system',appearance:systemAppearance()};
      requestGeneration.current++;activeTransition.current?.skip();
      setStoredPreference(target.current.preference);setAppearance(target.current.appearance);publish(target.current,activeMode);
    }else if(previous.mode!==activeMode){
      // Preserve the most recent requested preference even if its older native update is still queued.
      change(target.current,activeMode,undefined,true);
    }
  },[active,activeMode,change,publish]);
  const setPreference=useCallback((next:ThemePreference,origin?:HTMLElement)=>{
    if(!rootActive.current)return;
    const nextTarget={preference:next,appearance:next==='system'?systemAppearance():next};
    target.current=nextTarget;
    try{localStorage.setItem(storageKey,next);}catch{/* Optional browser persistence. */}
    change(nextTarget,currentMode.current,origin,false,nextTarget.appearance!==snapshot.current?.appearance);
  },[change]);
  useEffect(()=>{
    if(typeof matchMedia!=='function')return;
    const media=matchMedia('(prefers-color-scheme: dark)');
    const update=()=>{if(target.current.preference==='system')setPreference('system');};
    media.addEventListener('change',update);return()=>media.removeEventListener('change',update);
  },[setPreference]);
  useEffect(()=>()=>{rootActive.current=false;requestGeneration.current++;activeTransition.current?.skip();activeTransition.current=null;},[]);
  return (
    <ThemeContext.Provider value={{ appearance, preference, mode: activeMode, language, setPreference, themeBridge }}>
      <I18nProvider locale={language}>
        <div className={styles.scope} {...languageProps(language)} data-variant={variant}>
          {children}
        </div>
      </I18nProvider>
    </ThemeContext.Provider>
  );
}
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme requires ThemeProvider');
  return value;
}
