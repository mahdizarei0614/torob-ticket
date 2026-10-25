import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiClient,ClientError} from '@torob-ticket/client';
import {Button,ThemeProvider} from '@torob-ticket/ui';
import {ProviderReceiptView} from './provider-receipt-view';
import {readReturnCheckpoint} from './return-checkpoint';
import {hydrateReturn,type HydratedReturn} from './return-hydration';
export function ProviderPage({referralId,retained,onReturn}:{referralId:string;retained:boolean;onReturn:(restored?:HydratedReturn)=>void}){
 const [returning,setReturning]=useState(false),[notice,setNotice]=useState('');const heading=useRef<HTMLElement>(null),live=useRef(true);
 const data=useQuery({queryKey:['referral',referralId],queryFn:async({signal})=>{
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
 {data.data?<ProviderReceiptView receipt={data.data.receipt} catalog={data.data.catalog} hotel={data.data.hotel} onReturn={()=>void returnToComparison()} isReturning={returning}/>:<section style={{padding:'var(--space-6)'}}><h1>فروشنده نمایشی</h1><p role={data.error?'alert':'status'}>{data.error?failure:'در حال دریافت سابقه ارجاع…'}</p>{data.error&&<Button onPress={()=>void data.refetch()}>دریافت دوباره سابقه</Button>}<p>این صفحه فقط سابقه ارجاع را می‌خواند؛ خرید یا رزرو انجام نمی‌شود.</p><a href="/">شروع مقایسه تازه</a></section>}
 {notice&&<section style={{padding:'var(--space-6)'}}><p role="alert">{notice}</p><a href="/">شروع مقایسه تازه</a></section>}
 </main></ThemeProvider>;
}
