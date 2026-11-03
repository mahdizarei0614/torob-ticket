import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ConfirmReferralInput,ReferralIntent,ReferralReceipt,RecheckResult} from '@torob-ticket/contracts';
import {apiClient,ClientError,type ApiClient} from '@torob-ticket/client';
import {canonical,complete,sameFacts,sameLineage,type ReferralPayload} from './referral-facts';
import {useProviderHandoff} from './provider-handoff';
export type {ReferralPayload} from './referral-facts';
export interface ReferralAlternative {quoteId:string;label:string;select:()=>ReferralSource|undefined}
export interface ReferralSource {
 key:string;
 payload:ReferralPayload;
 isCurrent:()=>boolean;
 accept:(fresh:ReferralPayload)=>boolean;
 confirmed:(receipt:ReferralReceipt)=>boolean;
 refresh:()=>void;
 alternatives?:()=>ReferralAlternative[];
}
export type ReferralPhase='idle'|'checking'|'changed'|'confirming'|'unavailable'|'retry-confirm'|'refresh-required'|'handoff-error'|'completed';
export interface ReferralState {phase:ReferralPhase;source?:ReferralSource;intent?:ReferralIntent;error?:string;receipt?:ReferralReceipt;alternativeQuoteIds?:string[]}
interface Flow {id:string;source:ReferralSource;providerLabel:string;intent?:ReferralIntent;input?:ConfirmReferralInput;accepted:boolean;phase:ReferralPhase;operation:number;controller?:AbortController}
interface Options {client?:ApiClient;enabled?:boolean;onHandoff:(receipt:ReferralReceipt,source:ReferralSource)=>void|Promise<void>;timeoutMs?:number}
const identity=(payload:ReferralPayload)=>JSON.stringify([payload.kind,payload.quote.quoteId,payload.quote.version]);
const freshMessage='برای بررسی معتبر این پیشنهاد، یک مقایسه تازه انجام دهید و دوباره انتخاب کنید.';
function message(error:unknown){
 if(error instanceof ClientError){
  if(error.api?.code==='SEARCH_LIMIT')return 'دو بررسی دیگر در نشست فعال است؛ پس از پایان آن‌ها دوباره تلاش کنید.';
  if(error.api?.code==='SESSION_EXPIRED')return 'نشست در دسترس نیست؛ مقایسه را دوباره آماده کنید.';
  if(error.api?.code==='INTENT_EXPIRED')return 'زمان پذیرش این بررسی پایان یافته است. '+freshMessage;
  if(error.kind==='schema')return 'پاسخ با پیشنهاد انتخاب‌شده سازگار نبود. '+freshMessage;
 }
 return 'دریافت نتیجه بررسی ممکن نشد. '+freshMessage;
}
/** Client owns consent and request entry; server owns availability, pricing and idempotency. */
export function useReferralController({client=apiClient,enabled=true,onHandoff,timeoutMs=8000}:Options){
 const external=useProviderHandoff();
 const [state,setState]=useState<ReferralState>({phase:'idle'});
 const current=useRef<Flow|undefined>(undefined),live=useRef(true),epoch=useRef(0);
 const latest=useRef({client,enabled,onHandoff,timeoutMs,external});latest.current={client,enabled,onHandoff,timeoutMs,external};
 const blocked=useRef(new Set<string>()),recoveries=useRef(new Map<string,Flow>());
 const renderedEpoch=epoch.current,renderedFlow=current.current;
 function publish(flow:Flow|undefined,next:ReferralState){
  if(flow){
   flow.phase=next.phase;
   if(next.phase==='checking'||next.phase==='confirming')latest.current.external?.show(flow.id,flow.source.payload.quote.providerId,flow.providerLabel,()=>cancelFlow(flow));
   else if(next.phase==='completed')latest.current.external?.show(flow.id,flow.source.payload.quote.providerId,flow.providerLabel);
   else latest.current.external?.dismiss(flow.id);
  }
  setState(next);
 }
 function owns(flow:Flow){return live.current&&latest.current.enabled&&current.current===flow&&flow.source.isCurrent();}
 function saveRecovery(flow:Flow){recoveries.current.set(identity(flow.source.payload),flow);if(flow.intent)recoveries.current.set(identity(flow.intent.quote),flow);}
 function removeRecovery(flow:Flow){for(const [key,value]of recoveries.current)if(value.input?.idempotencyKey===flow.input?.idempotencyKey)recoveries.current.delete(key);}
 function invalidate(flow:Flow){flow.controller?.abort();latest.current.external?.dismiss(flow.id);if(current.current===flow){current.current=undefined;epoch.current++;setState({phase:'idle'});}}
 function requireFresh(flow:Flow,error=freshMessage){blocked.current.add(identity(flow.source.payload));publish(flow,{phase:'refresh-required',source:flow.source,error});}
 async function request<T>(flow:Flow,call:(signal:AbortSignal)=>Promise<T>){
  flow.controller?.abort();const controller=new AbortController();flow.controller=controller;const operation=++flow.operation;
  let timer:ReturnType<typeof setTimeout>|undefined;
  let onAbort:(()=>void)|undefined;
  try{return await Promise.race([call(controller.signal),new Promise<T>((_,reject)=>{onAbort=()=>reject(controller.signal.reason??new DOMException('Cancelled','AbortError'));controller.signal.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>controller.abort(new DOMException('Timed out','TimeoutError')),latest.current.timeoutMs);})]);}
  finally{clearTimeout(timer);if(onAbort)controller.signal.removeEventListener('abort',onAbort);if(flow.operation===operation&&flow.controller===controller)flow.controller=undefined;}
 }
 async function handoff(flow:Flow,receipt:ReferralReceipt,direct=false){
  try{
   if(latest.current.external){
    if(direct)await latest.current.external.deliverNow(flow.id,receipt.referralId,receipt.payload.quote.providerId,flow.providerLabel,()=>owns(flow));
    else await latest.current.external.deliver(flow.id,receipt.referralId,()=>owns(flow));
   }else await latest.current.onHandoff(receipt,flow.source);
   if(current.current!==flow)return;
   current.current=undefined;epoch.current++;setState({phase:'idle'});
  }catch{
   if(!owns(flow)){if(current.current===flow)invalidate(flow);return;}
   publish(flow,{phase:'handoff-error',source:flow.source,receipt,error:'ارجاع ثبت شده است؛ برای باز کردن صفحه فروشنده در زبانه تازه دوباره بزنید.'});
  }
 }
 async function confirm(flow:Flow){
  if(!owns(flow)||!flow.intent||!flow.input)return;
  publish(flow,{phase:'confirming',source:flow.source,intent:flow.intent});
  try{
   const receipt=await request(flow,signal=>latest.current.client.confirmReferral(flow.input!,signal));
   if(!owns(flow))return;
   if(receipt.intentId!==flow.intent.intentId||canonical(receipt.selection)!==canonical(flow.intent.selection)||canonical(receipt.payload)!==canonical(flow.intent.quote)||receipt.handoffPath!==`/provider-demo/${encodeURIComponent(receipt.referralId)}`){publish(flow,{phase:'retry-confirm',source:flow.source,intent:flow.intent,error:'نتیجه انتقال با همین بررسی سازگار نبود؛ نتیجه همان درخواست را دوباره دریافت کنید.'});saveRecovery(flow);return;}
   if(!flow.source.confirmed(receipt)){invalidate(flow);return;}
   removeRecovery(flow);publish(flow,{phase:'completed',source:flow.source,receipt});
   await handoff(flow,receipt);
  }catch(error){
   if(!owns(flow))return;
   if(error instanceof ClientError&&error.kind==='api'&&['INTENT_EXPIRED','QUOTE_EXPIRED','QUOTE_CHANGED','OFFER_UNAVAILABLE','INCOMPLETE_PRICE','SESSION_EXPIRED','NOT_FOUND','IDEMPOTENCY_CONFLICT'].includes(error.api?.code??'')){requireFresh(flow,message(error));removeRecovery(flow);}
   else{saveRecovery(flow);publish(flow,{phase:'retry-confirm',source:flow.source,intent:flow.intent,error:'پاسخ انتقال دریافت نشد؛ ممکن است ثبت شده باشد. نتیجه همان درخواست را دوباره بررسی کنید.'});}
  }
 }
 function acceptIntent(flow:Flow){
  if(!owns(flow)||!flow.intent)return false;
  if(Date.parse(flow.intent.expiresAt)<=Date.now()||!complete(flow.intent.quote,Date.now())){requireFresh(flow,'زمان پذیرش این بررسی پایان یافته است. '+freshMessage);return false;}
  if(!flow.source.accept(flow.intent.quote)){invalidate(flow);return false;}
  flow.accepted=true;flow.input={intentId:flow.intent.intentId,acceptedQuoteVersion:flow.intent.selection.quoteVersion,idempotencyKey:crypto.randomUUID()};return true;
 }
 async function begin(source:ReferralSource,providerLabel='فروشنده'){
  const found=recoveries.current.get(identity(source.payload));const recovery=found&&(canonical(source.payload)===canonical(found.intent?.quote)||canonical(source.payload)===canonical(found.source.payload))?found:undefined;
  const flow:Flow=recovery?{...recovery,id:crypto.randomUUID(),source,providerLabel,operation:0,controller:undefined}:{id:crypto.randomUUID(),source,providerLabel,accepted:false,phase:'checking',operation:0};
  current.current=flow;epoch.current++;
  if(recovery){publish(flow,{phase:'retry-confirm',source,intent:flow.intent,error:'پاسخ انتقال قبلی قطعی دریافت نشد؛ نتیجه همان درخواست را بررسی کنید.'});return;}
  if(blocked.current.has(identity(source.payload))||!complete(source.payload,Date.now())){requireFresh(flow);return;}
  publish(flow,{phase:'checking',source});
  try{
   const result:RecheckResult=await request(flow,signal=>latest.current.client.prepareReferral({kind:source.payload.kind,quoteId:source.payload.quote.quoteId,quoteVersion:source.payload.quote.version},signal));
   if(!owns(flow))return;
   if(result.status==='unavailable'){blocked.current.add(identity(source.payload));publish(flow,{phase:'unavailable',source,alternativeQuoteIds:result.alternativeQuoteIds,error:result.reason==='QUOTE_EXPIRED'?'اعتبار این قیمت پایان یافته است.':result.reason==='INCOMPLETE_PRICE'?'قیمت کامل قابل تأیید نبود.':'پیشنهاد انتخاب‌شده برای انتقال در دسترس نیست.'});return;}
   if(!sameLineage(source.payload,result.intent.quote)||!complete(result.intent.quote,Date.now())||result.intent.selection.kind!==result.intent.quote.kind||result.intent.selection.quoteId!==result.intent.quote.quote.quoteId||result.intent.selection.quoteVersion!==result.intent.quote.quote.version||(result.status==='changed'&&(result.previousQuoteVersion!==source.payload.quote.version||canonical(result.previousQuote)!==canonical(source.payload)))){requireFresh(flow,'پاسخ با پیشنهاد انتخاب‌شده سازگار نبود. '+freshMessage);return;}
   flow.intent=result.intent;
   if(result.status==='ready'){
    if(!sameFacts(source.payload,result.intent.quote)){requireFresh(flow,'شرایط پاسخ با قیمت نمایش‌داده‌شده یکسان نبود. '+freshMessage);return;}
    if(acceptIntent(flow))await confirm(flow);
   }else publish(flow,{phase:'changed',source,intent:flow.intent});
  }catch(error){if(owns(flow))requireFresh(flow,message(error));}
 }
 async function start(source:ReferralSource,providerLabel?:string){if(!live.current||!latest.current.enabled||epoch.current!==renderedEpoch||current.current||!source.isCurrent())return;await begin(source,providerLabel);}
 async function accept(){const flow=current.current;if(!flow||flow!==renderedFlow||flow.phase!=='changed'||!owns(flow))return;if(acceptIntent(flow))await confirm(flow);}
 function cancelFlow(flow:Flow){if(current.current!==flow)return;if(flow.phase==='changed'&&flow.intent&&latest.current.client.cancelReferralIntent)void latest.current.client.cancelReferralIntent(flow.intent.intentId).catch(()=>undefined);if(flow.phase==='changed'||flow.phase==='checking')blocked.current.add(identity(flow.source.payload));if(flow.phase==='confirming'&&flow.input)saveRecovery(flow);invalidate(flow);}
 function cancel(){const flow=current.current;if(!flow||flow!==renderedFlow)return;cancelFlow(flow);}
 async function retryConfirm(){const flow=current.current;if(flow&&flow===renderedFlow&&flow.phase==='retry-confirm'&&owns(flow))await confirm(flow);}
 function freshComparison(){const flow=current.current;if(!flow||flow!==renderedFlow||!owns(flow))return;const source=flow.source;invalidate(flow);source.refresh();}
 async function chooseAlternative(alternative:ReferralAlternative){
  const flow=current.current;if(!flow||flow!==renderedFlow||flow.phase!=='unavailable'||!owns(flow)||!state.alternativeQuoteIds?.includes(alternative.quoteId)||!flow.source.alternatives?.().some(a=>a.quoteId===alternative.quoteId))return;
  const source=alternative.select();if(!source||source.payload.quote.quoteId!==alternative.quoteId||!source.isCurrent())return;invalidate(flow);await begin(source);
 }
 function reopenReceipt(){const flow=current.current;if(flow&&flow===renderedFlow&&flow.phase==='handoff-error'&&state.receipt&&owns(flow)){const receipt=state.receipt;publish(flow,{phase:'completed',source:flow.source,receipt});void handoff(flow,receipt,true);}}
 useLayoutEffect(()=>{live.current=true;return()=>{live.current=false;const flow=current.current;flow?.controller?.abort();if(flow)latest.current.external?.dismiss(flow.id);};},[]);
 useEffect(()=>{const flow=current.current;if(flow&&(!enabled||!flow.source.isCurrent()))invalidate(flow);});
 return {state,start,accept,cancel,retryConfirm,freshComparison,chooseAlternative,reopenReceipt,needsFresh:(source:ReferralSource)=>blocked.current.has(identity(source.payload)),hasRecovery:(source:ReferralSource)=>recoveries.current.has(identity(source.payload))};
}
