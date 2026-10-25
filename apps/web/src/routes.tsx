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
 const retained=useRef<Location|undefined>(location.pathname==='/'?location:undefined);const returnScroll=useRef(0),wasProvider=useRef(false);const [restored,setRestored]=useState<HydratedReturn|undefined>();
 if(!provider&&location.pathname==='/'){if(retained.current&&retained.current.key!==location.key&&wasProvider.current===false)clearComparisonHistory();retained.current=location;}
 const covered=Boolean(provider),comparison=covered?retained.current:location;
 useLayoutEffect(()=>{if(covered){wasProvider.current=true;window.scrollTo({top:0,behavior:'instant'});}else if(wasProvider.current){wasProvider.current=false;window.scrollTo({top:restored?.checkpoint.scrollY??returnScroll.current,behavior:'instant'});}},[covered,restored]);
 function handoff(receipt:ReferralReceipt,checkpoint:ReturnCheckpoint){
  if(location.pathname!=='/'||receipt.handoffPath!==`/provider-demo/${receipt.referralId}`)return;
  retained.current=location;returnScroll.current=window.scrollY;writeReturnCheckpoint(checkpoint);retainComparisonHistory(location.key,location.search);void navigate(receipt.handoffPath);
 }
 function returnToComparison(value?:HydratedReturn){
  if(retained.current){void navigate(-1);return;}
  if(!value)return;setRestored(value);returnScroll.current=value.checkpoint.scrollY;void navigate({pathname:'/',search:value.checkpoint.returnSearch},{replace:true});
 }
 return <>
 {comparison&&(!covered||retained.current)&&<div hidden={covered} inert={covered||undefined} aria-hidden={covered||undefined}><DialogSuspensionProvider value={covered}><Routes location={comparison}><Route path="/" element={<SearchPage covered={covered} onHandoff={handoff} restore={restored}/>} /><Route path="/graphics-lab" element={<Suspense fallback={<p>در حال آماده‌سازی آزمایشگاه…</p>}><GraphicsLab/></Suspense>}/><Route path="/route-lab" element={<Suspense fallback={<p>در حال آماده‌سازی نقشه…</p>}><RouteLab/></Suspense>}/><Route path="*" element={<main lang="fa" dir="rtl"><h1>این صفحه پیدا نشد</h1><a href="/">بازگشت به جست‌وجوی سفر</a></main>}/></Routes></DialogSuspensionProvider></div>}
 {provider&&<ProviderPage key={provider[1]} referralId={provider[1]!} retained={Boolean(retained.current)} onReturn={returnToComparison}/>}
 </>;
}
export function ConsumerRoutes(){return <BrowserRouter><RetainedConsumerRoutes/></BrowserRouter>;}
