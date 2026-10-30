import { motion, useAnimationControls, useMotionValue } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useMotionPolicy } from '../motion/motion-surface';
import styles from '../styles/primitives.module.css';

interface TextFrame { opacity: number; y: number; filter: string }
interface TextState { value: string; epoch: number; outgoing?: string; from?: TextFrame; reuse?: boolean }
const settled = { opacity: 1, y: 0, filter: 'blur(0px)' };
const entering = { opacity: 0, y: 5, filter: 'blur(2px)' };

/** One current accessible phrase, with at most one inert outgoing visual. */
export function MotionText({ value, className, appear = false }: { value: string; className?: string; appear?: boolean }) {
  const policy = useMotionPolicy(), current = useAnimationControls(), outgoing = useAnimationControls();
  const opacity = useMotionValue(appear ? 0 : 1), y = useMotionValue(appear ? 5 : 0), filter = useMotionValue(appear ? 'blur(2px)' : 'blur(0px)');
  const oldOpacity = useMotionValue(0), oldY = useMotionValue(0), oldFilter = useMotionValue('blur(0px)');
  const [state, setState] = useState<TextState>({ value, epoch: 0 });
  const firstAppearance = useRef(appear), begun = useRef<number | undefined>(undefined), completed = useRef<number | undefined>(undefined);
  if (state.value !== value) {
    // An interrupted change keeps the strongest visible phrase instead of
    // accumulating exits or flashing a barely visible intermediate value.
    const keepCurrent = !state.outgoing || opacity.get() >= oldOpacity.get();
    const previous = keepCurrent ? state.value : state.outgoing!;
    setState({ value, epoch: state.epoch + 1, outgoing: previous === value ? undefined : previous, reuse: previous === value,
      from: keepCurrent ? { opacity: opacity.get(), y: y.get(), filter: filter.get() } : { opacity: oldOpacity.get(), y: oldY.get(), filter: oldFilter.get() } });
  }
  useLayoutEffect(() => {
    let live = true;
    current.stop(); outgoing.stop();
    if (!policy.enabled || completed.current === state.epoch || (state.epoch === 0 && !firstAppearance.current)) {
      current.set(settled); outgoing.set({ opacity: 0 }); completed.current = state.epoch;
      if (state.outgoing !== undefined) setState(previous => previous.epoch === state.epoch ? { ...previous, outgoing: undefined } : previous);
      return;
    }
    if (begun.current !== state.epoch) {
      begun.current = state.epoch;
      current.set({ ...(state.reuse && state.from ? state.from : entering) });
      if (state.outgoing !== undefined) outgoing.set({ ...(state.from ?? settled) });
    }
    // A development StrictMode replay resumes the visible values: only a
    // completed entry settles directly, never an entry merely attempted.
    const transitions = [current.start({ ...settled, transition: { duration: .3, ease: [.22, 1, .36, 1] } })];
    if (state.outgoing !== undefined) transitions.push(outgoing.start({ opacity: 0, y: -4, filter: 'blur(2px)', transition: { duration: .22, ease: 'easeOut' } }));
    void Promise.all(transitions).then(() => {
      if (!live) return;
      completed.current = state.epoch;
      setState(previous => previous.epoch === state.epoch && previous.outgoing !== undefined ? { ...previous, outgoing: undefined } : previous);
    });
    return () => { live = false; current.stop(); outgoing.stop(); };
  }, [current, outgoing, policy.enabled, state.epoch]);
  return <span className={[styles.motionText, className].filter(Boolean).join(' ')} data-motion-text data-text-motion={policy.enabled ? 'finite' : 'static'}>
    <motion.span data-motion-text-visual="current" initial={false} animate={current} style={{ opacity, y, filter }}>{value}</motion.span>
    {state.outgoing !== undefined && <motion.span className={styles.motionTextOutgoing} data-motion-text-visual="outgoing" aria-hidden="true" inert initial={false} animate={outgoing} style={{ opacity: oldOpacity, y: oldY, filter: oldFilter }}>{state.outgoing}</motion.span>}
  </span>;
}
