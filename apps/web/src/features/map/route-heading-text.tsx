import {useLayoutEffect,useRef} from 'react';
import {gsap} from 'gsap';
import {ScrambleTextPlugin} from 'gsap/ScrambleTextPlugin';
import {useMotionPolicy} from '@torob-ticket/ui';
import styles from './trip-map.module.css';

gsap.registerPlugin(ScrambleTextPlugin);
export interface HeadingTextHistory {values:Map<string,string>;initialized:boolean}
interface TextRun {text:string;from:string;complete:boolean}

/** Only visual heading letters scramble; the accessible route stays exact. */
export function RouteHeadingText({text,identity,slot,history,disabled=false,present=true}:{text:string;identity:string;slot:string;history:HeadingTextHistory;disabled?:boolean;present?:boolean}){
 const visual=useRef<HTMLSpanElement>(null),entry=useRef<TextRun|undefined>(undefined);
 const policy=useMotionPolicy({disabled});
 useLayoutEffect(()=>{
  const node=visual.current;if(!node)return;
  let run=entry.current;
  if(!run||run.text!==text){
   const previous=history.values.get(slot);
   run={text,from:entry.current?node.textContent??previous??'':previous??'',complete:previous===text||!history.initialized||!present};
   entry.current=run;if(present)history.values.set(slot,text);
  }
  if(!policy.enabled||!present)run.complete=true;
  if(run.complete){if(node.textContent!==text)node.textContent=text;node.dataset['scrambleState']='settled';return;}
  const active=run;let live=true;node.textContent=active.from;node.dataset['scrambleState']='scrambling';
  const tween=gsap.to(node,{duration:1,ease:'power1.inOut',scrambleText:{text,chars:'ابتثجچحخدذرزژسشصضطظعغفقکگلمنوهی',rightToLeft:true,tweenLength:false,speed:.45,revealDelay:.12},onComplete:()=>{if(!live||entry.current!==active)return;active.complete=true;node.textContent=text;node.dataset['scrambleState']='settled';}});
  return()=>{live=false;tween.kill();};
 },[text,slot,history,policy.enabled,present]);
 return <span className={styles.headingTextOwner}><span className={styles.headingTextMeasure} aria-hidden="true">{text}</span><span ref={visual} className={styles.headingTextVisual} data-map-city-label={identity} data-route-scramble-duration="1" aria-hidden="true"/><span className={styles.headingAccessible}>{text}</span></span>;
}
