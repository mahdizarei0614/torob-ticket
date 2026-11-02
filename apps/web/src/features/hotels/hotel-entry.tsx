import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {CatalogSnapshot,HotelQuoteSnapshot,Itinerary,ReferralReceipt,SessionInfo,TransportSearchQuery} from '@torob-ticket/contracts';
import {Button,displayHotelName,MotionSurface,MotionText} from '@torob-ticket/ui';
import {validateDraft} from '../search/search-url';
import type {SearchController,TripMapController} from '../map/use-trip-map';
import {HotelDialog} from './hotel-dialog';
import {HotelEntryPresence} from './hotel-entry-presence';
import {tripKey,type HotelTrip} from './hotel-state';
import {useHotelDiscovery,type HotelRestore} from './use-hotel-discovery';
import {ProviderAction} from '../referral/referral-dialog';
import type {ReferralSource,useReferralController} from '../referral/referral-controller';
import type {ReturnCheckpoint} from '../referral/return-checkpoint';
import styles from './hotels.module.css';
interface ReferralProps {authorityKey?:string;blocked?:boolean;onResume?:()=>void;onSessionExpired?:()=>void;flow?:ReturnType<typeof useReferralController>;restore?:HotelRestore;onCheckpoint?:(value:ReturnCheckpoint['hotel'])=>void;onOriginScroll?:(y:number)=>void}
interface PlacementProps {desktop?:boolean;portalTarget?:HTMLElement|null}
export function HotelEntry({controller,map,catalog,session,onCovered,onSelectHotelQuote,flow,restore,onCheckpoint,onOriginScroll,authorityKey,blocked,onResume,onSessionExpired,desktop=false,portalTarget}:{controller:SearchController;map:TripMapController;catalog:CatalogSnapshot;session:SessionInfo;onCovered:(open:boolean)=>void;onSelectHotelQuote?:(quote:HotelQuoteSnapshot|undefined)=>void}&ReferralProps&PlacementProps){
 const accepted=useRef<TransportSearchQuery|undefined>(undefined);const s=controller.state;
 if(s.committed&&s.generation&&s.searchId&&controller.resultIsCurrent(s.generation,s.searchId))accepted.current=s.committed;
 const candidate=validateDraft(s.draft,catalog,session).query;
 // A complete route exposes the entry; the hotel model waits for its actual
 // selected-ticket arrival instead of borrowing a departure date.
 if(candidate)accepted.current=candidate;
 if(!accepted.current)return null;
 return <HotelEntryContent controller={controller} map={map} catalog={catalog} session={session} query={accepted.current} routeReady={Boolean(candidate&&tripKey(candidate)===tripKey(accepted.current))} desktop={desktop} portalTarget={portalTarget} onCovered={onCovered} onSelectHotelQuote={onSelectHotelQuote} flow={flow} restore={restore} onCheckpoint={onCheckpoint} onOriginScroll={onOriginScroll} authorityKey={authorityKey} blocked={blocked} onResume={onResume} onSessionExpired={onSessionExpired}/>;
}
function HotelEntryContent({controller,map,catalog,session,query,routeReady,desktop=false,portalTarget,onCovered,onSelectHotelQuote,flow,restore,onCheckpoint,onOriginScroll,authorityKey,blocked,onResume,onSessionExpired}:{controller:SearchController;map:TripMapController;catalog:CatalogSnapshot;session:SessionInfo;query:TransportSearchQuery;routeReady:boolean;onCovered:(open:boolean)=>void;onSelectHotelQuote?:(quote:HotelQuoteSnapshot|undefined)=>void}&ReferralProps&PlacementProps){
 const hotelReceipt=useRef<ReferralReceipt|undefined>(restore?.receipt);const opened=useRef(Boolean(restore));const retained=useRef<{key:string;comparison:string;itinerary?:Itinerary}>({key:tripKey(query),comparison:[controller.state.generation,controller.state.searchId].join('/'),itinerary:restore?.contextBlocked?undefined:restore?.tripItinerary});
 const selection=map.state.selection;const actual=selection&&selection.valid&&Date.parse(selection.quote.expiresAt)>Date.now()&&selection.quote.completeness.status==='complete'&&selection.quote.eligibility.status==='eligible'&&controller.resultIsCurrent(selection.inspection.owner.generation,selection.inspection.owner.searchId)&&tripKey(selection.inspection.query)===tripKey(query)?selection.inspection.itinerary:undefined;
 const key=tripKey(query),comparison=[controller.state.generation,controller.state.searchId].join('/');
 if(retained.current.key!==key||retained.current.comparison!==comparison)retained.current={key,comparison,itinerary:actual};
 // A selected arrival remains a travel fact during fare expiry, but cannot
 // cross into a replacement comparison or a changed route.
 if(actual)retained.current={key,comparison,itinerary:actual};
 if(controller.resetting){opened.current=false;retained.current={key,comparison};}
 const draftKey=tripKey(controller.state.draft);
 const canOpen=Boolean(routeReady&&draftKey===key&&!controller.resetting);
 const itinerary=actual??retained.current.itinerary;
 const available=Boolean(canOpen&&itinerary&&controller.state.generation&&controller.state.searchId&&controller.resultIsCurrent(controller.state.generation,controller.state.searchId));
 const trip:HotelTrip={query,draftKey,available,itinerary};
 const model=useHotelDiscovery({trip,catalog,session,resetting:controller.resetting,onSelectHotelQuote,restore,authorityKey,blocked,onResume,onSessionExpired});const latestModel=useRef(model);latestModel.current=model;
 const [opening,setOpening]=useState(false);const pendingOpen=useRef<symbol|undefined>(undefined);const mounted=useRef(true);
 const latestController=useRef(controller);latestController.current=controller;
 const entryOwner=useRef({key,canOpen,authorityKey,blocked:Boolean(blocked),epoch:0});
 if(entryOwner.current.key!==key||entryOwner.current.canOpen!==canOpen||entryOwner.current.authorityKey!==authorityKey||entryOwner.current.blocked!==Boolean(blocked))entryOwner.current={key,canOpen,authorityKey,blocked:Boolean(blocked),epoch:entryOwner.current.epoch+1};
 const ownerEpoch=entryOwner.current.epoch;
 const entryRef=useRef<HTMLDivElement>(null);const wasOpen=useRef(model.open);
 const priorEntryKey=useRef(key),transferFocus=useRef(false);
 if((!routeReady||priorEntryKey.current!==key)&&entryRef.current?.contains(document.activeElement))transferFocus.current=true;
 priorEntryKey.current=key;
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pendingOpen.current=undefined;};},[]);
 useLayoutEffect(()=>{pendingOpen.current=undefined;setOpening(false);},[ownerEpoch]);
 useLayoutEffect(()=>{
  if(!transferFocus.current)return;transferFocus.current=false;
  const active=document.activeElement;if(active&&active!==document.body&&!entryRef.current?.contains(active))return;
  document.querySelector<HTMLInputElement>('form[aria-label="جست‌وجوی سفر"] input')?.focus({preventScroll:true});
 },[routeReady,key]);
 useLayoutEffect(()=>{onCovered(model.open);return()=>onCovered(false);},[model.open,onCovered]);
 useLayoutEffect(()=>{
  const closing=wasOpen.current&&!model.open;wasOpen.current=model.open;if(!closing)return;
  // Resizing can remount the portaled trigger while the dialog retains its state.
  const frame=requestAnimationFrame(()=>{const entry=entryRef.current?.dataset['hotelPresence']==='present'?entryRef.current:undefined;const target=entry?.querySelector<HTMLButtonElement>('button:not(:disabled)')??document.querySelector<HTMLInputElement>('form[aria-label="جست‌وجوی سفر"] input');target?.focus({preventScroll:true});});
  return()=>cancelAnimationFrame(frame);
 },[model.open]);
 function source():ReferralSource|undefined{
  const lease=model.selectionLease();if(!lease)return undefined;
  return {key:'hotel/'+lease.key,payload:{kind:'hotel',quote:lease.quote},isCurrent:lease.isCurrent,accept:fresh=>fresh.kind==='hotel'&&lease.accept(fresh.quote),confirmed:receipt=>{const okay=lease.confirmed(receipt);if(okay){hotelReceipt.current=receipt;emitCheckpoint();}return okay;},refresh:lease.refresh,alternatives:()=>model.state.snapshot?.quotes.filter(q=>q.quoteId!==lease.quote.quoteId).map(q=>({quoteId:q.quoteId,label:`${displayHotelName(model.state.snapshot?.hotels.find(h=>h.hotelId===q.hotelId))} · ${q.total.amountRial/10} تومان برای کل اقامت`,select:()=>{model.selectQuote(q);return source();}}))??[]};
 }
 const selectedSource=source();
 function emitCheckpoint(){if(!opened.current){onCheckpoint?.(undefined);return;}const current=model.readState();onCheckpoint?.({open:model.open,stale:model.stale,hotelSearchId:current.snapshot?.hotelSearchId,draft:current.draft,selected:current.selected?{quoteId:current.selected.quoteId,version:current.selected.version}:undefined,referralId:hotelReceipt.current?.payload.kind==='hotel'&&JSON.stringify(hotelReceipt.current.payload.quote)===JSON.stringify(current.selected)?hotelReceipt.current.referralId:undefined,scrollTop:document.querySelector<HTMLElement>('[data-hotel-scroll]')?.scrollTop??document.querySelector<HTMLElement>('[data-hotel-dialog]')?.closest<HTMLElement>('[data-dialog-scroll]')?.scrollTop??0});}
 emitCheckpoint();
 const city=catalog.cities.find(c=>c.id===query.destinationCityId);
 function ownsEntry(){return mounted.current&&entryOwner.current.epoch===ownerEpoch&&entryOwner.current.canOpen&&!entryOwner.current.blocked&&!latestController.current.resetting;}
 async function openHotel(){
  if(pendingOpen.current||!ownsEntry())return;
  const currentController=latestController.current,origin=window.scrollY;const before=currentController.currentIntent();
  if(tripKey(before.draft)!==key)return;
  const hasComparison=Boolean(before.committed&&tripKey(before.committed)===key&&before.generation&&before.searchId&&currentController.resultIsCurrent(before.generation,before.searchId));
  const token=Symbol('hotel-open');pendingOpen.current=token;
  try{
   if(!hasComparison){
    setOpening(true);
    const started=currentController.submit(query,false);
    const expected=currentController.currentIntent();const generation=expected.generation,revision=expected.intentRevision;
    await started;
    const latest=latestController.current.currentIntent();
    if(!ownsEntry()||pendingOpen.current!==token||latest.generation!==generation||latest.intentRevision!==revision||tripKey(latest.draft)!==key||!latest.committed||tripKey(latest.committed)!==key||!latest.generation||!latest.searchId||!latestController.current.resultIsCurrent(latest.generation,latest.searchId))return;
   }
   if(!ownsEntry()||pendingOpen.current!==token)return;
   if(latestModel.current.openDialog()){onOriginScroll?.(origin);if(!opened.current){if(actual)retained.current={key,comparison,itinerary:actual};opened.current=true;}}
  }finally{if(pendingOpen.current===token){pendingOpen.current=undefined;if(mounted.current)setOpening(false);}}
 }
 const entry=<HotelEntryPresence visible={routeReady} identity={key} desktop={desktop}>{present=><MotionSurface ref={entryRef} purpose={desktop?'dock':'content'} motionKey={key} className={`${styles.entry} ${desktop?styles.dockedEntry:''}`} data-hotel-entry data-hotel-presence={present?'present':'exiting'} data-hotel-route={key} data-hotel-placement={desktop?'map':'inline'} inert={!present} aria-hidden={!present||undefined}>
  <div className={styles.entryIcon} aria-hidden="true"><svg width="30" height="30" viewBox="0 0 32 32"><path d="M5 28V8h14v20M19 16h8v12M2 28h28M10 13h4m-4 5h4m-4 5h4m9-3h1" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg></div>
  <div><strong><MotionText value={`اقامت در ${city?.name??'مقصد'}`}/></strong><span>اقامتگاه مناسب سفرت را پیدا کن</span></div>
  <Button variant="secondary" aria-label={`مقایسه اقامتگاه‌های ${city?.name??'مقصد'}`} isDisabled={!present||controller.resetting||blocked||controller.pending||controller.startLimitReached} isLoading={opening} onPress={()=>{void openHotel();}}>{`مقایسه اقامتگاه‌های ${city?.name??'مقصد'}`}</Button>
 </MotionSurface>}</HotelEntryPresence>;
 return <>{desktop?(portalTarget?createPortal(entry,portalTarget):null):entry}<HotelDialog model={model} catalog={catalog} session={session} canApplyTrip={available} initialScrollTop={restore?.scrollTop} referralAction={flow&&selectedSource?{quoteId:selectedSource.payload.quote.quoteId,node:<ProviderAction compact layout="ticket" flow={flow} source={selectedSource} catalog={catalog}/ >}:undefined}/></>;
}
