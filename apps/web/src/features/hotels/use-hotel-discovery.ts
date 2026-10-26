import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {CatalogSnapshot,SessionInfo,HotelQuoteSnapshot,GeoPoint,HotelSearchQuery,HotelSearchSnapshot,ReferralReceipt} from '@torob-ticket/contracts';
import {apiClient,ClientError,type ApiClient} from '@torob-ticket/client';
import {createHotelState,hotelReducer,hotelQuery,queryKey,tripKey,tripStamp,tripStale,type HotelTrip,type HotelDraft,type HotelAction} from './hotel-state';
export interface HotelRestore {snapshot:HotelSearchSnapshot;draft:HotelDraft;selected?:HotelQuoteSnapshot;open:boolean;scrollTop:number;receipt?:ReferralReceipt;tripItinerary?:HotelTrip['itinerary'];contextBlocked?:boolean}
export interface HotelDiscoveryProps {trip:HotelTrip;catalog:CatalogSnapshot;session:SessionInfo;resetting?:boolean;client?:ApiClient;onSelectHotelQuote?:(quote:HotelQuoteSnapshot|undefined)=>void;restore?:HotelRestore}
function failure(error:unknown){if(error instanceof ClientError){if(error.api?.code==='SEARCH_LIMIT')return 'دو بررسی دیگر در نشست فعال است؛ پس از پایان آن‌ها دوباره تلاش کنید.';if(error.api?.code==='SESSION_EXPIRED')return 'نشست در دسترس نیست؛ صفحه را تازه کنید و دوباره مقایسه کنید.';if(error.kind==='network')return 'دریافت اقامتگاه‌ها ممکن نشد؛ اتصال را بررسی و دوباره تلاش کنید.';}return 'پاسخ معتبر اقامت دریافت نشد؛ دوباره مقایسه کنید.';}
/** Every method is bound to the rendered view, edit revision and provisional transaction. */
export function useHotelDiscovery({trip,catalog,session,resetting=false,client=apiClient,onSelectHotelQuote,restore}:HotelDiscoveryProps){
 const [state,setState]=useState(()=>restore?hotelReducer(createHotelState(trip,catalog),{type:'hydrate',snapshot:restore.snapshot,draft:restore.draft,selected:restore.selected,contextBlocked:restore.contextBlocked}):createHotelState(trip,catalog));const currentState=useRef(state);currentState.current=state;
 const [open,setOpen]=useState(restore?.open??false);const view=useRef({open:restore?.open??false,epoch:0});const renderedView=view.current;
 const initialized=useRef(Boolean(restore));
 const live=useRef(true);const latest=useRef({trip,resetting,client,onSelectHotelQuote});latest.current={trip,resetting,client,onSelectHotelQuote};
 const request=useRef<{controller:AbortController;revision:number;view:typeof renderedView;trip:string}|undefined>(undefined);
 const [,tick]=useState(0);const capturedTrip=tripStamp(trip);const tripEpoch=useRef({stamp:capturedTrip,epoch:0});if(tripEpoch.current.stamp!==capturedTrip)tripEpoch.current={stamp:capturedTrip,epoch:tripEpoch.current.epoch+1};const renderedTripEpoch=tripEpoch.current.epoch,revision=state.revision,pointToken=state.point?.token;
 function abort(){request.current?.controller.abort();request.current=undefined;}
 function send(action:HotelAction){const next=hotelReducer(currentState.current,action);currentState.current=next;setState(next);return next;}
 function viewOwns(needOpen=true){return live.current&&!latest.current.resetting&&view.current===renderedView&&(!needOpen||view.current.open);}
 function owns(needOpen=true,allowStale=false){return viewOwns(needOpen)&&currentState.current===state&&currentState.current.revision===revision&&tripStamp(latest.current.trip)===capturedTrip&&tripEpoch.current.epoch===renderedTripEpoch&&(allowStale||!tripStale(currentState.current,latest.current.trip));}
 function openDialog(){if(!viewOwns(false)||tripEpoch.current.epoch!==renderedTripEpoch||view.current.open)return false;if(!initialized.current){initialized.current=true;send({type:'apply-trip',trip:latest.current.trip,catalog});}view.current={open:true,epoch:view.current.epoch+1};setOpen(true);return true;}
 function closeDialog(){if(!viewOwns())return;abort();view.current={open:false,epoch:view.current.epoch+1};setOpen(false);send({type:'settle-close'});}
 function edit(patch:Partial<HotelDraft>){if(!owns())return;abort();send({type:'edit',patch});latest.current.onSelectHotelQuote?.(undefined);}
 async function search(query:HotelSearchQuery,expectedView:typeof renderedView){
  abort();const controller=new AbortController();const started=send({type:'start',query});latest.current.onSelectHotelQuote?.(undefined);const item={controller,revision:started.revision,view:expectedView,trip:tripStamp(latest.current.trip)};request.current=item;
  const valid=()=>live.current&&!latest.current.resetting&&!controller.signal.aborted&&request.current===item&&view.current===item.view&&view.current.open&&currentState.current.revision===item.revision&&tripStamp(latest.current.trip)===item.trip&&!tripStale(currentState.current,latest.current.trip);
  try{const snapshot=await latest.current.client.startHotelSearch(query,controller.signal);if(valid())send({type:'success',revision:item.revision,snapshot});}
  catch(error){if(valid())send({type:'failure',revision:item.revision,error:failure(error)});}
  finally{if(request.current===item)request.current=undefined;}
 }
 async function submit(){if(!owns()||currentState.current.point||currentState.current.status==='loading')return;const checked=hotelQuery(currentState.current,catalog,session.anchorInstant);if(checked.query)await search(checked.query,renderedView);}
 async function changeSort(sort:HotelSearchQuery['sort']){if(!owns()||currentState.current.point)return;abort();const next=send({type:'edit',patch:{sort}});latest.current.onSelectHotelQuote?.(undefined);const checked=hotelQuery(next,catalog,session.anchorInstant);if(checked.query)await search(checked.query,renderedView);}
 function applyTrip(){if(!owns(true,true)||!latest.current.trip.available||latest.current.trip.draftKey!==tripKey(latest.current.trip.query))return;abort();send({type:'apply-trip',trip:latest.current.trip,catalog});latest.current.onSelectHotelQuote?.(undefined);}
 function openPoint(){if(!owns())return;abort();send({type:'open-point'});}
 function pointOwns(){return viewOwns()&&tripEpoch.current.epoch===renderedTripEpoch&&!tripStale(currentState.current,latest.current.trip)&&pointToken!==undefined&&currentState.current.point?.token===pointToken;}
 function setPoint(value:GeoPoint){if(pointOwns())send({type:'point',value});}
 function cancelPoint(){if(!pointOwns())return;send({type:'cancel-point'});}
 async function applyPoint(){if(!pointOwns()||!currentState.current.point?.value)return;abort();const next=send({type:'apply-point'});latest.current.onSelectHotelQuote?.(undefined);const checked=hotelQuery(next,catalog,session.anchorInstant);if(checked.query)await search(checked.query,renderedView);}
 function selectQuote(quote:HotelQuoteSnapshot){if(!owns())return;const checked=hotelQuery(currentState.current,catalog,session.anchorInstant);if(!checked.query||queryKey(checked.query)!==queryKey(quote.query)||currentState.current.point)return;const next=send({type:'select',quote,now:Date.now()});if(next.selected===quote)latest.current.onSelectHotelQuote?.(quote);}
 useLayoutEffect(()=>{live.current=true;return()=>{live.current=false;abort();};},[]);
 useLayoutEffect(()=>{if(resetting){initialized.current=false;abort();view.current={open:false,epoch:view.current.epoch+1};setOpen(false);const next={...createHotelState(latest.current.trip,catalog),revision:currentState.current.revision+1};currentState.current=next;setState(next);latest.current.onSelectHotelQuote?.(undefined);}},[resetting]);
 useEffect(()=>{if(request.current){abort();send({type:'settle-close'});}if(currentState.current.point)send({type:'cancel-point'});if(tripStale(currentState.current,latest.current.trip))latest.current.onSelectHotelQuote?.(undefined);},[capturedTrip]);
 const expiry=state.snapshot?.quotes.reduce((min,q)=>Math.min(min,Date.parse(q.expiresAt)),Infinity);
 useEffect(()=>{if(expiry===undefined||!Number.isFinite(expiry)||expiry<=Date.now())return;const timer=setTimeout(()=>{tick(v=>v+1);latest.current.onSelectHotelQuote?.(undefined);},expiry-Date.now()+1);return()=>clearTimeout(timer);},[expiry]);
 const checked=hotelQuery(state,catalog,session.anchorInstant),stale=tripStale(state,trip);
 const selected=state.selected&&Date.parse(state.selected.expiresAt)>Date.now()&&!stale?state.selected:undefined;
 function selectionLease(){
  const selected=currentState.current.selected;const checked=hotelQuery(currentState.current,catalog,session.anchorInstant);if(!checked.query||!selected||queryKey(checked.query)!==queryKey(selected.query))return undefined;if(!selected||!viewOwns()||currentState.current.revision!==revision||tripStamp(latest.current.trip)!==capturedTrip||tripStale(currentState.current,latest.current.trip)||currentState.current.point)return undefined;
  const capturedView=view.current,capturedRevision=currentState.current.revision,capturedStamp=tripStamp(latest.current.trip);let expected=selected;
  const isCurrent=()=>live.current&&!latest.current.resetting&&view.current===capturedView&&view.current.open&&currentState.current.revision===capturedRevision&&tripStamp(latest.current.trip)===capturedStamp&&!tripStale(currentState.current,latest.current.trip)&&currentState.current.selected===expected;
  const accept=(quote:HotelQuoteSnapshot)=>{if(!isCurrent())return false;const next=send({type:'bind-rechecked',previous:{quoteId:expected.quoteId,version:expected.version},quote,now:Date.now()});if(next.selected?.version!==quote.version)return false;expected=next.selected;latest.current.onSelectHotelQuote?.(expected);return true;};
  const confirmed=(receipt:ReferralReceipt)=>isCurrent()&&receipt.payload.kind==='hotel'&&JSON.stringify(receipt.payload.quote)===JSON.stringify(expected)&&Date.parse(receipt.confirmedAt)>=Date.parse(expected.observedAt)&&Date.parse(receipt.confirmedAt)<Date.parse(expected.expiresAt);
  const refresh=()=>{if(!isCurrent())return;const checked=hotelQuery(currentState.current,catalog,session.anchorInstant);if(checked.query)void search(checked.query,view.current);};
  return {refresh,quote:selected,key:[capturedView.epoch,capturedRevision,selected.quoteId,selected.version].join('/'),isCurrent,accept,confirmed};
 }
 return {contextBlocked:Boolean(state.contextBlocked),readState:()=>currentState.current,selectionLease,state,open,stale,query:checked.query,errors:checked.errors,selected,openDialog,closeDialog,edit,submit,changeSort,applyTrip,openPoint,setPoint,cancelPoint,applyPoint,selectQuote,isPointCurrent:pointOwns};
}
export type HotelDiscovery=ReturnType<typeof useHotelDiscovery>;
