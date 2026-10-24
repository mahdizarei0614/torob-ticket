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
export interface ThemeContextValue {
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
}: {
  children: ReactNode;
  mode?: Mode;
  language?: Language;
  variant?: 'consumer' | 'admin';
  initialPreference?: ThemePreference;
  onThemeChange?: (theme: ThemeSnapshot) => void;
}) {
  const [preference, setStoredPreference] = useState<ThemePreference>(
    () => initialPreference ?? savedPreference(),
  );
  const [appearance, setAppearance] = useState<Appearance>(() =>
    preference === 'system' ? systemAppearance() : preference,
  );
  const bridge = useRef(onThemeChange);
  bridge.current = onThemeChange;
  const activeTransition = useRef<ViewTransition | null>(null);
  const activeMode = variant === 'admin' ? 'flight' : mode;
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = appearance;
    root.dataset.preference = preference;
    root.dataset.mode = activeMode;
    root.style.colorScheme = appearance;
    bridge.current?.({ appearance, mode: activeMode, colors: readThemeColors(root) });
  }, [appearance, preference, activeMode]);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      if (preference === 'system') setAppearance(media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [preference]);
  useEffect(
    () => () => {
      activeTransition.current?.skipTransition();
    },
    [],
  );
  const setPreference = useCallback(
    (next: ThemePreference, origin?: HTMLElement) => {
      const nextAppearance = next === 'system' ? systemAppearance() : next;
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* Theme switching remains available. */
      }
      const update = () =>
        flushSync(() => {
          setStoredPreference(next);
          setAppearance(nextAppearance);
        });
      activeTransition.current?.skipTransition();
      const reduced =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!document.startViewTransition || reduced || nextAppearance === appearance) {
        update();
        return;
      }
      const rect = origin?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : innerHeight / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const transition = document.startViewTransition(update);
      activeTransition.current = transition;
      void transition.ready
        .then(() => {
          if (activeTransition.current !== transition) return;
          document.documentElement.animate?.(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 260, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' },
          );
        })
        .catch(() => {
          /* Skipped/superseded transitions still apply their DOM update. */
        });
    },
    [appearance],
  );
  return (
    <ThemeContext.Provider value={{ appearance, preference, mode: activeMode, language, setPreference }}>
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
