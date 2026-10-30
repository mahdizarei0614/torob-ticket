import { I18nProvider, Label, Radio, RadioGroup } from 'react-aria-components';
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import { MotionPolicyProvider, useMotionPolicy } from '../motion/motion-surface';
import { languageProps, type Language } from './language';
import { MotionText } from './motion-text';
import styles from '../styles/primitives.module.css';
export interface SegmentedControlProps {
  label: string;
  language?: Language;
  value: string;
  onChange: (value: string) => void;
  options: readonly { id: string; label: string; icon?: ReactNode; disabled?: boolean }[];
  isDisabled?: boolean;
  hideLabel?: boolean;
}
type Option = SegmentedControlProps['options'][number];
interface RetiredOption { option: Option; gapAfter: boolean }

/** Actual width changes let neighboring controls reflow without scaling words. */
function SegmentSlot({ option, present, enter, gapAfter, enabled, epoch, onRetire }: {
  option: Option; present: boolean; enter: boolean; gapAfter: boolean; enabled: boolean; epoch: number;
  onRetire: (id: string, epoch: number) => void;
}) {
  const body = useRef<HTMLDivElement>(null), controls = useAnimationControls();
  const measured = useRef(0), [measurement, setMeasurement] = useState(0);
  const begun = useRef<string | undefined>(undefined), completed = useRef<string | undefined>(undefined);
  const geometry = JSON.stringify([present, option.label, gapAfter]);
  useLayoutEffect(() => {
    const element = body.current;
    if (!element) return;
    measured.current = element.getBoundingClientRect().width;
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => {
      const width = element.getBoundingClientRect().width;
      if (Math.abs(width - measured.current) < .25) return;
      measured.current = width; setMeasurement(version => version + 1);
    });
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  useLayoutEffect(() => {
    let live = true;
    controls.stop();
    const width = body.current?.getBoundingClientRect().width ?? 0;
    measured.current = width;
    const frame = { width: present ? width || 'auto' : 0, opacity: present ? 1 : 0, y: present ? 0 : -4, filter: present ? 'blur(0px)' : 'blur(2px)' };
    if (!enabled || completed.current === geometry || (!begun.current && !enter && present)) {
      controls.set(frame); begun.current = geometry; completed.current = geometry;
      if (!present) onRetire(option.id, epoch);
      return;
    }
    if (!begun.current && enter) controls.set({ width: width > 0 ? 0 : 'auto', opacity: 0, y: 5, filter: 'blur(2px)' });
    begun.current = geometry; completed.current = undefined;
    void controls.start({ ...frame, transition: { duration: .34, ease: [.22, 1, .36, 1] } }).then(() => {
      if (!live) return;
      completed.current = geometry;
      if (!present) onRetire(option.id, epoch);
    });
    return () => { live = false; controls.stop(); };
  }, [controls, enabled, geometry, measurement, option.id, present, enter, epoch, onRetire]);
  return <motion.div className={styles.segmentSlot} data-segment-slot={present ? 'current' : 'outgoing'} data-segment-retired-option={present ? undefined : option.id} inert={!present} aria-hidden={!present || undefined} initial={false} animate={controls}>
    <div ref={body} className={styles.segmentSlotInner} data-gap-after={gapAfter || undefined}>
      <Radio className={styles.radio} value={option.id} data-segment-option={present ? option.id : undefined} aria-label={option.label} isDisabled={!present || option.disabled}>
        {option.icon && <span aria-hidden="true">{option.icon}</span>}
        <MotionText value={option.label}/>
      </Radio>
    </div>
  </motion.div>;
}
export function SegmentedControl({
  label,
  language = 'fa',
  value,
  onChange,
  options,
  isDisabled,
  hideLabel = false,
}: SegmentedControlProps) {
  const track = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const policy = useMotionPolicy({ disabled: isDisabled });
  const liveChoice = useRef({ options, onChange, blocked: false });
  liveChoice.current = { options, onChange, blocked: !!(isDisabled || policy.covered || policy.disabled || !policy.documentVisible) };
  const choose = useCallback((next: string) => {
    const live = liveChoice.current;
    if (live.blocked || !live.options.some(option => option.id === next && !option.disabled)) return;
    live.onChange(next);
  }, []);
  const signature = JSON.stringify(options.map(option => [option.id, option.label, !!option.disabled]));
  const [history, setHistory] = useState<{ signature: string; options: readonly Option[]; retired: RetiredOption[]; priorIds: string[]; epoch: number }>({ signature, options, retired: [], priorIds: [], epoch: 0 });
  const restoreFocus = useRef<Element | undefined>(undefined);
  if (history.signature !== signature) {
    const currentIds = new Set(options.map(option => option.id));
    const focused = document.activeElement?.closest<HTMLElement>('[data-segment-option]');
    if (focused && track.current?.contains(focused) && !currentIds.has(focused.dataset['segmentOption']!)) restoreFocus.current = document.activeElement ?? undefined;
    // Keep one previous cohort, never an unbounded AnimatePresence exit queue.
    setHistory({ signature, options, retired: history.options.flatMap((option, index) => currentIds.has(option.id) ? [] : [{ option, gapAfter: index < history.options.length - 1 }]), priorIds: history.options.map(option => option.id), epoch: history.epoch + 1 });
  }
  const retire = useCallback((id: string, epoch: number) => setHistory(previous => previous.epoch === epoch && previous.retired.some(item => item.option.id === id) ? { ...previous, retired: previous.retired.filter(item => item.option.id !== id) } : previous), []);
  const [ready, setReady] = useState(false);
  const target = useRef<{value:string;x:number;y:number;width:number;height:number;motion:boolean}|undefined>(undefined);
  const measure = useCallback(() => {
    const element=track.current;
    const selected=element&&Array.from(element.querySelectorAll<HTMLElement>('[data-segment-option]')).find(option=>option.dataset['segmentOption']===value);
    if(!element||!selected){controls.stop();controls.set({opacity:0});target.current=undefined;setReady(false);return;}
    const box=element.getBoundingClientRect(),option=selected.getBoundingClientRect(),slot=selected.closest<HTMLElement>('[data-segment-slot]')?.getBoundingClientRect();
    const left=Math.max(option.left,slot?.left??option.left),right=Math.min(option.right,slot?.right??option.right);
    if(right<=left||option.height<=0){controls.set({opacity:0});return;}
    const next={value,x:left-box.left-element.clientLeft+element.scrollLeft,y:option.top-box.top-element.clientTop+element.scrollTop,width:right-left,height:option.height,motion:policy.enabled};
    const previous=target.current;target.current=next;
    if(previous&&Object.keys(next).every(key=>next[key as keyof typeof next]===previous[key as keyof typeof previous]))return;
    controls.stop();setReady(true);
    const frame={x:next.x,y:next.y,width:next.width,height:next.height,opacity:1};
    if(previous&&previous.value!==value&&policy.enabled)void controls.start({...frame,transition:{duration:.32,ease:[.22,1,.36,1]}});
    else controls.set(frame);
  },[controls,value,policy.enabled]);
  // Label/font changes can move the selected option even when its value stays
  // unchanged. Resizes settle directly; only deliberate choice changes slide.
  useLayoutEffect(()=>{measure();});
  useLayoutEffect(()=>{
    const previous=restoreFocus.current;
    if(!previous)return;
    restoreFocus.current=undefined;
    // Native disabling may blur the old input to body. A different control's
    // newly chosen focus, including a foreground dialog, always wins.
    if(document.activeElement!==previous&&document.activeElement!==document.body)return;
    if(isDisabled||policy.covered||policy.disabled||!policy.documentVisible)return;
    const next=options.find(option=>option.id===value&&!option.disabled)??options.find(option=>!option.disabled);
    const element=Array.from(track.current?.querySelectorAll<HTMLElement>('[data-segment-option]')??[]).find(option=>option.dataset['segmentOption']===next?.id);
    element?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
  },[signature,isDisabled,value,policy.covered,policy.disabled,policy.documentVisible]);
  useLayoutEffect(()=>{
    const element=track.current;if(!element)return;
    let live=true;const update=()=>{if(live)measure();};
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(update);
    observer?.observe(element);element.querySelectorAll<HTMLElement>('[data-segment-option]').forEach(option=>observer?.observe(option));
    window.addEventListener('resize',update);void document.fonts?.ready.then(update);
    return()=>{live=false;observer?.disconnect();window.removeEventListener('resize',update);};
  },[measure,signature]);
  useLayoutEffect(()=>()=>controls.stop(),[controls]);
  return (
    <I18nProvider locale={language}>
      <MotionPolicyProvider disabled={isDisabled}>
      <RadioGroup
        className={styles.field}
        {...languageProps(language)}
        value={value}
        onChange={choose}
        orientation="horizontal"
        isDisabled={isDisabled}
      >
        <Label className={hideLabel ? styles.srOnly : styles.label}><MotionText value={label}/></Label>
        <div ref={track} className={styles.segments} data-segment-track data-indicator-ready={ready||undefined} data-segment-value={value}>
          <motion.span className={styles.segmentIndicator} aria-hidden="true" data-segment-indicator initial={false} animate={controls}/>
          {[...options.map((option,index) => ({ option, present:true, gapAfter:index < options.length - 1 })), ...history.retired.map(item => ({ ...item, present:false }))].map(({option,present,gapAfter}) => <SegmentSlot key={option.id} option={option} present={present} enter={present && history.epoch > 0 && !history.priorIds.includes(option.id)} gapAfter={gapAfter} enabled={policy.enabled} epoch={history.epoch} onRetire={retire}/>)}
        </div>
      </RadioGroup>
      </MotionPolicyProvider>
    </I18nProvider>
  );
}
