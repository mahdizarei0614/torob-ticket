import {lazy,Suspense,useLayoutEffect,useRef,useState} from 'react';
import {BrowserRouter,Route,Routes,useLocation,useNavigate} from 'react-router';
import type {Location} from 'react-router';
import type {ReferralReceipt} from '@torob-ticket/contracts';
import {DialogSuspensionProvider} from '@torob-ticket/ui';
import {SearchPage} from './features/search/search-page';
import {ProviderPage} from './features/referral/provider-page';
import {retainComparisonHistory,clearComparisonHistory} from './features/referral/provider-history';
import {writeReturnCheckpoint,type ReturnCheckpoint} from './features/referral/return-checkpoint';
import type {HydratedReturn} from './features/referral/return-hydration';
const GraphicsLab=lazy(()=>import('@torob-ticket/graphics').then(module=>({default:module.GraphicsLab})));
const RouteLab=lazy(()=>import('@torob-ticket/graphics').then(module=>({default:module.RouteLab})));
export function RetainedConsumerRoutes(){
 const location=useLocation(),navigate=useNavigate();const provider=/^\/provider-demo\/([A-Za-z0-9_-]+)$/.exec(location.pathname);
 const retained=useRef<Location|undefined>(location.pathname==='/'?location:undefined);const returnScroll=useRef(0),wasProvider=useRef(false);const [restored,setRestored]=useState<HydratedReturn|undefined>();const [restorePending,setRestorePending]=useState(false);const restoreRun=useRef<{value:HydratedReturn;entryKey?:string;done:boolean}|undefined>(undefined);const [,resumeComparison]=useState(0);const actualLocation=useRef(location);actualLocation.current=location;
 if(!provider&&location.pathname==='/'){if(retained.current&&retained.current.key!==location.key&&wasProvider.current===false)clearComparisonHistory();retained.current=location;}
 const run=restoreRun.current;if(run&&!provider&&location.pathname==='/'&&location.search===run.value.checkpoint.returnSearch&&!run.entryKey)run.entryKey=location.key;
 const covered=Boolean(provider),comparison=covered?retained.current:location;
 const reopening=!covered&&wasProvider.current&&!restorePending;
 const restorationSeed=restored&&run&&comparison&&run.value===restored&&comparison.key===run.entryKey&&comparison.search===restored.checkpoint.returnSearch?restored:undefined;
 useLayoutEffect(()=>{if(covered){if(!wasProvider.current)window.scrollTo({top:0,behavior:'instant'});wasProvider.current=true;}else if(wasProvider.current){wasProvider.current=false;if(!restorePending){window.scrollTo({top:returnScroll.current,behavior:'instant'});resumeComparison(n=>n+1);}}},[covered,restorePending]);
 function handoff(receipt:ReferralReceipt,checkpoint:ReturnCheckpoint){
  if(location.pathname!=='/'||receipt.handoffPath!==`/provider-demo/${receipt.referralId}`)return;
  retained.current=location;returnScroll.current=checkpoint.scrollY;writeReturnCheckpoint(checkpoint);retainComparisonHistory(location.key,location.search);void navigate(receipt.handoffPath);
 }
 function returnToComparison(value?:HydratedReturn){
  if(retained.current){void navigate(-1);return;}
  if(!value)return;restoreRun.current={value,done:false};setRestorePending(true);setRestored(value);returnScroll.current=value.checkpoint.scrollY;void navigate({pathname:'/',search:value.checkpoint.returnSearch},{replace:true});
 }
 function restoreReady(value:HydratedReturn,ready=true){const pending=restoreRun.current,now=actualLocation.current;if(!pending||pending.done||pending.value!==value||now.pathname!=='/'||now.search!==value.checkpoint.returnSearch||pending.entryKey!==now.key)return;pending.done=true;if(ready)window.scrollTo({top:value.checkpoint.scrollY,behavior:'instant'});setRestorePending(false);}
 useLayoutEffect(()=>{const pending=restoreRun.current;if(pending?.entryKey&&!provider&&(location.pathname!=='/'||location.search!==pending.value.checkpoint.returnSearch||location.key!==pending.entryKey)){restoreRun.current=undefined;setRestorePending(false);setRestored(undefined);}},[location.key,location.search,location.pathname]);
 return <>
 {comparison&&(!covered||retained.current)&&<div hidden={covered} inert={covered||undefined} aria-hidden={covered||undefined}><DialogSuspensionProvider value={covered||restorePending||reopening}><Routes location={comparison}><Route path="/" element={<SearchPage themeActive={!covered} covered={covered||restorePending||reopening} onHandoff={handoff} restore={restorationSeed} onRestoreReady={restoreReady}/>} /><Route path="/graphics-lab" element={<Suspense fallback={<p>در حال آماده‌سازی آزمایشگاه…</p>}><GraphicsLab/></Suspense>}/><Route path="/route-lab" element={<Suspense fallback={<p>در حال آماده‌سازی نقشه…</p>}><RouteLab/></Suspense>}/><Route path="*" element={<main lang="fa" dir="rtl"><h1>این صفحه پیدا نشد</h1><a href="/">بازگشت به جست‌وجوی سفر</a></main>}/></Routes></DialogSuspensionProvider></div>}
 {provider&&<ProviderPage key={provider[1]} referralId={provider[1]!} retained={Boolean(retained.current)} onReturn={returnToComparison}/>}
 </>;
}
export function ConsumerRoutes(){return <BrowserRouter><RetainedConsumerRoutes/></BrowserRouter>;}
