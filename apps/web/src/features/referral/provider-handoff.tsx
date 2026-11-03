import {createContext,useCallback,useContext,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Dialog as AriaDialog,Heading,Modal,ModalOverlay} from 'react-aria-components';
import {Button,ProviderMark,useMotionEnvironment} from '@torob-ticket/ui';
import {openProviderWindow} from './provider-window';
import styles from './provider-handoff.module.css';

interface Presentation {id:string;providerId:string;label:string;started:number;cancel?:()=>void}
interface PendingDelay {id:string;timer:ReturnType<typeof setTimeout>;reject:(error:Error)=>void}
interface ProviderHandoff {
 show:(id:string,providerId:string,label:string,cancel?:()=>void)=>void;
 dismiss:(id:string)=>void;
 deliver:(id:string,referralId:string,isCurrent:()=>boolean)=>Promise<void>;
 deliverNow:(id:string,referralId:string,providerId:string,label:string,isCurrent:()=>boolean)=>Promise<void>;
}
const Context=createContext<ProviderHandoff|undefined>(undefined);
export const useProviderHandoff=()=>useContext(Context);
const cancelled=()=>new DOMException('Provider handoff no longer owns the comparison','AbortError');
const blocked=()=>new Error('provider-popup-blocked');

/** Application policy only: legacy receipt routes remain usable without this boundary. */
export function ProviderHandoffBoundary({children,minimumVisibleMs=720}:{children:ReactNode;minimumVisibleMs?:number}){
 const [presentation,setPresentation]=useState<Presentation>();
 const lastPresentation=useRef<Presentation|undefined>(undefined);
 const current=useRef<Presentation|undefined>(undefined),live=useRef(true),delays=useRef(new Set<PendingDelay>());
 const environment=useMotionEnvironment();
 const motion=environment.documentVisible&&!environment.reducedMotion;
 const latest=useRef({motion,minimumVisibleMs});latest.current={motion,minimumVisibleMs};
 const clearDelays=useCallback((id?:string)=>{for(const entry of delays.current){if(id!==undefined&&entry.id!==id)continue;clearTimeout(entry.timer);delays.current.delete(entry);entry.reject(cancelled());}},[]);
 const dismiss=useCallback((id:string)=>{
  clearDelays(id);
  if(current.current?.id!==id)return;
  current.current=undefined;if(live.current)setPresentation(undefined);
 },[clearDelays]);
 const show=useCallback((id:string,providerId:string,label:string,cancel?:()=>void)=>{
  if(!live.current)return;
  const old=current.current;if(old&&old.id!==id)clearDelays(old.id);
  const next={id,providerId,label:label.trim()||'فروشنده',started:old?.id===id?old.started:performance.now(),cancel};
  current.current=next;lastPresentation.current={...next,cancel:undefined};setPresentation(next);
 },[clearDelays]);
 const wait=useCallback((id:string,ms:number)=>new Promise<void>((resolve,reject)=>{
  if(!live.current||current.current?.id!==id){reject(cancelled());return;}
  if(ms<=0){resolve();return;}
  const entry:PendingDelay={id,timer:setTimeout(()=>{delays.current.delete(entry);resolve();},ms),reject};delays.current.add(entry);
 }),[]);
 const owns=useCallback((id:string,isCurrent:()=>boolean)=>live.current&&current.current?.id===id&&isCurrent(),[]);
 const fade=useCallback(async(id:string)=>{
  if(current.current?.id!==id)return;
  setPresentation(undefined);
  await wait(id,latest.current.motion?180:0);
  if(current.current?.id===id)current.current=undefined;
 },[wait]);
 const deliver=useCallback(async(id:string,referralId:string,isCurrent:()=>boolean)=>{
  const item=current.current;if(!item||item.id!==id)throw cancelled();
  // Finite presentation time lets the requested backdrop enter before navigation;
  // it is not a fabricated server request or provider booking step.
  await wait(id,Math.max(0,latest.current.minimumVisibleMs-(performance.now()-item.started)));
  if(!owns(id,isCurrent))throw cancelled();
  if(document.visibilityState==='hidden'||!openProviderWindow(referralId))throw blocked();
  await fade(id);
 },[fade,owns,wait]);
 const deliverNow=useCallback((id:string,referralId:string,providerId:string,label:string,isCurrent:()=>boolean)=>{
  // This path is called synchronously from the popup-blocked retry gesture.
  // No await precedes window.open, and no referral is prepared/confirmed again.
  if(!live.current||!isCurrent()||document.visibilityState==='hidden')return Promise.reject(cancelled());
  show(id,providerId,label);
  if(!openProviderWindow(referralId)){dismiss(id);return Promise.reject(blocked());}
  return fade(id);
 },[dismiss,fade,show]);
 const value=useMemo(()=>({show,dismiss,deliver,deliverNow}),[show,dismiss,deliver,deliverNow]);
 useLayoutEffect(()=>{live.current=true;return()=>{live.current=false;current.current=undefined;clearDelays();};},[clearDelays]);
 const displayed=presentation??lastPresentation.current;
 return <Context.Provider value={value}>{children}
  <ModalOverlay className={styles.backdrop} data-handoff-motion={motion?'finite':'static'} isOpen={Boolean(presentation)} isDismissable={false} onOpenChange={open=>{if(!open)presentation?.cancel?.();}}>
   <Modal className={styles.panel} lang="fa" dir="rtl"><AriaDialog className={styles.dialog} aria-label="انتقال به فروشنده" data-provider-handoff-overlay>
    <div className={styles.loader} aria-hidden="true"><svg className={styles.loaderTrack} viewBox="0 0 120 120"><circle cx="60" cy="60" r="54"/><circle className={styles.loaderArc} cx="60" cy="60" r="54"/></svg><ProviderMark providerId={displayed?.providerId} size={64}/></div>
    <Heading slot="title" className={styles.title}>در حال انتقال به {displayed?.label??'فروشنده'}</Heading>
    <p role="status" className={styles.caption}>صفحه فروشنده در زبانه تازه باز می‌شود</p>
    {presentation?.cancel&&<Button variant="quiet" onPress={presentation.cancel}>بازگشت به مقایسه</Button>}
   </AriaDialog></Modal>
  </ModalOverlay>
 </Context.Provider>;
}
