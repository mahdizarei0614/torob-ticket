import {lazy,useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiClient,ClientError} from '@torob-ticket/client';
import {Button,LoadingSkeleton,ThemeProvider} from '@torob-ticket/ui';
import {DeferredBoundary} from '../../deferred-boundary';
import {readReturnCheckpoint} from './return-checkpoint';
import {hydrateReturn,type HydratedReturn} from './return-hydration';
const ProviderReceiptView=lazy(()=>import('./provider-receipt-view').then(module=>({default:module.ProviderReceiptView})));
export function ProviderPage({referralId,retained,onReturn}:{referralId:string;retained:boolean;onReturn:(restored?:HydratedReturn)=>void}){
 const [mount]=useState(()=>crypto.randomUUID());
 const [returning,setReturning]=useState(false),[notice,setNotice]=useState('');const heading=useRef<HTMLElement>(null),live=useRef(true);
 const data=useQuery({queryKey:['referral',referralId,mount],queryFn:async({signal})=>{
  const receipt=await apiClient.getReferral(referralId,signal);const catalog=await apiClient.catalogReadonly(signal).catch(()=>undefined);const checkpoint=readReturnCheckpoint(referralId);
  const restored=checkpoint?await hydrateReturn(checkpoint,receipt,apiClient,signal).catch(()=>undefined):undefined;
  return {receipt,catalog,hotel:restored?.hotelMetadata};
 },retry:false,staleTime:Infinity,refetchOnWindowFocus:false});
 useEffect(()=>{live.current=true;heading.current?.focus({preventScroll:true});return()=>{live.current=false;};},[referralId]);
 async function returnToComparison(){
  if(returning)return;if(retained){onReturn();return;}setReturning(true);setNotice('');
  try{
   // Deliberate Return may bootstrap the current cookie namespace; display never does.
   await apiClient.session();const checkpoint=readReturnCheckpoint(referralId);
   if(!checkpoint||!data.data){setNotice('زمینه این مقایسه در دسترس نیست. از یک مقایسه تازه شروع کنید.');return;}
   const receipt=await apiClient.getReferral(referralId);const restored=await hydrateReturn(checkpoint,receipt,apiClient);
   if(live.current)onReturn(restored);
  }catch{if(live.current)setNotice('شواهد مقایسه قبلی در نشست فعلی در دسترس نیست؛ هیچ قیمت یا انتخابی بازسازی نشد. از یک مقایسه تازه شروع کنید.');}
  finally{if(live.current)setReturning(false);}
 }
 const failure=data.error instanceof ClientError&&data.error.api?.code==='NOT_FOUND'?'این ارجاع در نشست فعلی پیدا نشد.':data.error instanceof ClientError&&data.error.api?.code==='SESSION_EXPIRED'?'نشست این ارجاع در دسترس نیست.':'دریافت سابقه ارجاع ممکن نشد.';
 return <ThemeProvider language="fa" mode={data.data?.receipt.payload.kind==='transport'?data.data.receipt.payload.itinerary.mode:'flight'}><main ref={heading} tabIndex={-1} lang="fa" dir="rtl" data-provider-page>
 {data.data?<DeferredBoundary key={referralId} loading={<section style={{padding:'var(--space-6)'}} data-receipt-loading><h1>جزئیات ارجاع</h1><p role="status">در حال آماده‌سازی جزئیات ارجاع…</p><LoadingSkeleton rows={2}/><Button onPress={()=>void returnToComparison()} isDisabled={returning}>بازگشت به مقایسه سفر</Button></section>} unavailable={<section style={{padding:'var(--space-6)'}}><h1>جزئیات ارجاع</h1><p role="alert">نمایش جزئیات ارجاع ممکن نشد.</p><Button onPress={()=>void returnToComparison()} isDisabled={returning}>بازگشت به مقایسه سفر</Button><p><a href="/">شروع مقایسه تازه</a></p></section>}><ProviderReceiptView receipt={data.data.receipt} catalog={data.data.catalog} hotel={data.data.hotel} onReturn={()=>void returnToComparison()} isReturning={returning}/></DeferredBoundary>:<section style={{padding:'var(--space-6)'}}><h1>جزئیات ارجاع</h1><p role={data.error?'alert':'status'}>{data.error?failure:'در حال دریافت سابقه ارجاع…'}</p>{data.error&&<Button onPress={()=>void data.refetch()}>دریافت دوباره سابقه</Button>}<p>جزئیات پیشنهاد و زمان ثبت ارجاع در این صفحه نمایش داده می‌شود.</p><a href="/">شروع مقایسه تازه</a></section>}
 {notice&&<section style={{padding:'var(--space-6)'}}><p role="alert">{notice}</p><a href="/">شروع مقایسه تازه</a></section>}
 </main></ThemeProvider>;
}
