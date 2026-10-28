import { I18nProvider, Label, Radio, RadioGroup } from 'react-aria-components';
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import { useMotionPolicy } from '../motion/motion-surface';
import { languageProps, type Language } from './language';
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
  const [ready, setReady] = useState(false);
  const target = useRef<{value:string;x:number;y:number;width:number;height:number;motion:boolean}|undefined>(undefined);
  const measure = useCallback(() => {
    const element=track.current;
    const selected=element&&Array.from(element.querySelectorAll<HTMLElement>('[data-segment-option]')).find(option=>option.dataset['segmentOption']===value);
    if(!element||!selected){controls.stop();controls.set({opacity:0});target.current=undefined;setReady(false);return;}
    const box=element.getBoundingClientRect(),option=selected.getBoundingClientRect();
    if(option.width<=0||option.height<=0)return;
    const next={value,x:option.left-box.left-element.clientLeft+element.scrollLeft,y:option.top-box.top-element.clientTop+element.scrollTop,width:option.width,height:option.height,motion:policy.enabled};
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
    const element=track.current;if(!element)return;
    let live=true;const update=()=>{if(live)measure();};
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(update);
    observer?.observe(element);element.querySelectorAll<HTMLElement>('[data-segment-option]').forEach(option=>observer?.observe(option));
    window.addEventListener('resize',update);void document.fonts?.ready.then(update);
    return()=>{live=false;observer?.disconnect();window.removeEventListener('resize',update);};
  },[measure,options]);
  useLayoutEffect(()=>()=>controls.stop(),[controls]);
  return (
    <I18nProvider locale={language}>
      <RadioGroup
        className={styles.field}
        {...languageProps(language)}
        value={value}
        onChange={onChange}
        orientation="horizontal"
        isDisabled={isDisabled}
      >
        <Label className={hideLabel ? styles.srOnly : styles.label}>{label}</Label>
        <div ref={track} className={styles.segments} data-segment-track data-indicator-ready={ready||undefined} data-segment-value={value}>
          <motion.span className={styles.segmentIndicator} aria-hidden="true" data-segment-indicator initial={false} animate={controls}/>
          {options.map((option) => (
            <Radio className={styles.radio} key={option.id} value={option.id} data-segment-option={option.id} isDisabled={option.disabled}>
              {option.icon && <span aria-hidden="true">{option.icon}</span>}
              {option.label}
            </Radio>
          ))}
        </div>
      </RadioGroup>
    </I18nProvider>
  );
}
