import {createContext,useContext,useLayoutEffect,useMemo,useRef,type ReactNode} from 'react';
import {motion,useAnimationControls,type HTMLMotionProps} from 'motion/react';
import {motionSpecifications,resolveMotionPolicy,useMotionEnvironment,type MotionPurpose} from './motion-policy';
interface Coverage {covered:boolean;disabled:boolean}
const CoverageContext=createContext<Coverage>({covered:false,disabled:false});
export function MotionPolicyProvider({children,covered=false,disabled=false}:{children:ReactNode;covered?:boolean;disabled?:boolean}) {
 const parent=useContext(CoverageContext);
 const effectiveCovered=parent.covered||covered,effectiveDisabled=parent.disabled||disabled;
 const value=useMemo(()=>({covered:effectiveCovered,disabled:effectiveDisabled}),[effectiveCovered,effectiveDisabled]);
 return <CoverageContext.Provider value={value}>{children}</CoverageContext.Provider>;
}
/** A native foreground dialog owns its motion while the underlying page is covered. */
export function ForegroundMotionPolicy({children,suspended=false}:{children:ReactNode;suspended?:boolean}) {
 const inherited=useContext(CoverageContext);
 const value=useMemo(()=>({covered:suspended,disabled:inherited.disabled}),[suspended,inherited.disabled]);
 return <CoverageContext.Provider value={value}>{children}</CoverageContext.Provider>;
}
export function useMotionPolicy({covered=false,disabled=false}:{covered?:boolean;disabled?:boolean}={}) {
 const inherited=useContext(CoverageContext),environment=useMotionEnvironment();
 const state={...environment,covered:inherited.covered||covered,disabled:inherited.disabled||disabled};
 return {...state,enabled:resolveMotionPolicy(state)};
}
export type MotionSurfaceProps=Omit<HTMLMotionProps<'div'>,'initial'|'animate'|'exit'|'transition'|'variants'|'layout'|'layoutId'|'onAnimationStart'|'onAnimationComplete'|'whileHover'|'whileTap'|'whileInView'|'whileFocus'|'whileDrag'|'drag'|'dragControls'> & {
 purpose?:MotionPurpose;motionKey?:string|number;covered?:boolean;disabled?:boolean;
};
const finalFrame={opacity:1,y:0};
/** A finite entry per explicit key. Coverage/hidden/reduced motion settles immediately, and resume never replays. */
export function MotionSurface({children,purpose='content',motionKey,covered,disabled,...props}:MotionSurfaceProps) {
 const controls=useAnimationControls(),policy=useMotionPolicy({covered,disabled});
 const entry=useRef<{key:string|number|undefined}|undefined>(undefined);
 useLayoutEffect(()=>{
  const fresh=!entry.current||!Object.is(entry.current.key,motionKey);
  entry.current={key:motionKey};controls.stop();
  if(!policy.enabled||!fresh){controls.set(finalFrame);return;}
  const spec=motionSpecifications[purpose];
  controls.set({opacity:0,y:spec.offset});
  void controls.start({...finalFrame,transition:{duration:spec.duration,ease:'easeOut'}});
  return()=>{controls.stop();};
 },[controls,policy.enabled,purpose,motionKey]);
 return <motion.div {...props} initial={false} animate={controls} data-motion-policy={policy.enabled?'finite':'static'}>{children}</motion.div>;
}
