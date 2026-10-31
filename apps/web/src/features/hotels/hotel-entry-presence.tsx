import {useEffect,useLayoutEffect,useRef,type ReactNode} from 'react';
import {AnimatePresence,motion,useAnimationControls,usePresence} from 'motion/react';
import {useMotionPolicy} from '@torob-ticket/ui';
import styles from './hotels.module.css';

/** Only the trigger's visual is retained; its discovery model stays outside. */
export function HotelEntryPresence({visible,identity,desktop,children}:{visible:boolean;identity:string;desktop:boolean;children:(present:boolean)=>ReactNode}){
 return <AnimatePresence mode="wait">{visible&&<HotelEntryVisual key={identity} identity={identity} desktop={desktop}>{children}</HotelEntryVisual>}</AnimatePresence>;
}

function HotelEntryVisual({identity,desktop,children}:{identity:string;desktop:boolean;children:(present:boolean)=>ReactNode}){
 const [present,remove]=usePresence(),policy=useMotionPolicy(),controls=useAnimationControls(),initialized=useRef(false);
 useLayoutEffect(()=>{
  let current=true;controls.stop();
  const frame={opacity:present?1:0,y:present||!policy.enabled?0:desktop?24:6,height:present||desktop?'auto':0};
  const fresh=!initialized.current;initialized.current=true;
  if(fresh&&present&&policy.enabled&&!desktop)controls.set({...frame,height:0});
  if(!policy.enabled||fresh&&present&&desktop)controls.set(frame);
  else void controls.start({...frame,transition:{duration:.28,ease:'easeOut'}}).then(()=>{if(current&&!present)remove?.();});
  return()=>{current=false;controls.stop();};
 },[controls,present,desktop,policy.enabled,remove]);
 // Presence registration is passive; static exits must not wait for a hidden RAF.
 useEffect(()=>{if(!present&&!policy.enabled)remove?.();},[present,policy.enabled,remove]);
 return <motion.div className={styles.hotelEntryPresence} data-hotel-presence-frame data-hotel-route={identity} data-hotel-placement={desktop?'map':'inline'} inert={!present} aria-hidden={!present||undefined} initial={false} animate={controls}>{children(present)}</motion.div>;
}
