import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {CatalogSnapshot,HotelQuoteSnapshot,Itinerary,ReferralReceipt,SessionInfo,TransportSearchQuery} from '@torob-ticket/contracts';
import {Button,displayHotelName,MotionSurface,MotionText} from '@torob-ticket/ui';
import {validateDraft} from '../search/search-url';
import type {SearchController,TripMapController} from '../map/use-trip-map';
import {HotelDialog} from './hotel-dialog';
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
 // A new complete route may discover hotels before choosing a ticket. Restored
 // stay evidence remains bound to its original comparison until explicitly updated.
 if(candidate&&!restore)accepted.current=candidate;
 if(!accepted.current)return null;
 return <HotelEntryContent controller={controller} map={map} catalog={catalog} session={session} query={accepted.current} routeReady={Boolean(candidate&&tripKey(candidate)===tripKey(accepted.current))} desktop={desktop} portalTarget={portalTarget} onCovered={onCovered} onSelectHotelQuote={onSelectHotelQuote} flow={flow} restore={restore} onCheckpoint={onCheckpoint} onOriginScroll={onOriginScroll} authorityKey={authorityKey} blocked={blocked} onResume={onResume} onSessionExpired={onSessionExpired}/>;
}
function HotelEntryContent({controller,map,catalog,session,query,routeReady,desktop,portalTarget,onCovered,onSelectHotelQuote,flow,restore,onCheckpoint,onOriginScroll,authorityKey,blocked,onResume,onSessionExpired}:{controller:SearchController;map:TripMapController;catalog:CatalogSnapshot;session:SessionInfo;query:TransportSearchQuery;routeReady:boolean;onCovered:(open:boolean)=>void;onSelectHotelQuote?:(quote:HotelQuoteSnapshot|undefined)=>void}&ReferralProps&PlacementProps){
 const hotelReceipt=useRef<ReferralReceipt|undefined>(restore?.receipt);const opened=useRef(Boolean(restore));const retained=useRef<{key:string;itinerary?:Itinerary}>({key:tripKey(query),itinerary:restore?.tripItinerary});
 const selection=map.state.selection;const actual=selection&&selection.valid&&Date.parse(selection.quote.expiresAt)>Date.now()&&selection.quote.completeness.status==='complete'&&selection.quote.eligibility.status==='eligible'&&controller.resultIsCurrent(selection.inspection.owner.generation,selection.inspection.owner.searchId)&&tripKey(selection.inspection.query)===tripKey(query)?selection.inspection.itinerary:undefined;
 const key=tripKey(query);
 if(retained.current.key!==key)retained.current={key,itinerary:actual};
 // A valid arrival bound to an already-opened independent stay is a travel fact,
 // not a historical fare. Filter-only refreshes never manufacture a new arrival.
 if(opened.current&&actual)retained.current={key,itinerary:actual};
 if(controller.resetting){opened.current=false;retained.current={key};}
 const draftKey=tripKey(controller.state.draft);
 const available=Boolean(routeReady&&draftKey===key&&!controller.resetting);
 const trip:HotelTrip={query,draftKey,available,itinerary:opened.current?retained.current.itinerary:actual};
 const model=useHotelDiscovery({trip,catalog,session,resetting:controller.resetting,onSelectHotelQuote,restore,authorityKey,blocked,onResume,onSessionExpired});
 const [opening,setOpening]=useState(false);const pendingOpen=useRef<symbol|undefined>(undefined);const mounted=useRef(true);
 const entryRef=useRef<HTMLDivElement>(null);const wasOpen=useRef(model.open);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pendingOpen.current=undefined;};},[]);
 useLayoutEffect(()=>{onCovered(model.open);return()=>onCovered(false);},[model.open,onCovered]);
 useLayoutEffect(()=>{
  const closing=wasOpen.current&&!model.open;wasOpen.current=model.open;if(!closing)return;
  // Resizing can remount the portaled trigger while the dialog retains its state.
  const frame=requestAnimationFrame(()=>{const target=entryRef.current?.querySelector<HTMLButtonElement>('button')??document.querySelector<HTMLInputElement>('form[aria-label="جست‌وجوی سفر"] input');target?.focus({preventScroll:true});});
  return()=>cancelAnimationFrame(frame);
 },[model.open]);
 function source():ReferralSource|undefined{
  const lease=model.selectionLease();if(!lease)return undefined;
  return {key:'hotel/'+lease.key,payload:{kind:'hotel',quote:lease.quote},isCurrent:lease.isCurrent,accept:fresh=>fresh.kind==='hotel'&&lease.accept(fresh.quote),confirmed:receipt=>{const okay=lease.confirmed(receipt);if(okay){hotelReceipt.current=receipt;emitCheckpoint();}return okay;},refresh:lease.refresh,alternatives:()=>model.state.snapshot?.quotes.filter(q=>q.quoteId!==lease.quote.quoteId).map(q=>({quoteId:q.quoteId,label:`${displayHotelName(model.state.snapshot?.hotels.find(h=>h.hotelId===q.hotelId))} · ${q.total.amountRial/10} تومان برای کل اقامت`,select:()=>{model.selectQuote(q);return source();}}))??[]};
 }
 const selectedSource=source();
 function emitCheckpoint(){if(!opened.current){onCheckpoint?.(undefined);return;}const current=model.readState();onCheckpoint?.({open:model.open,stale:model.stale,hotelSearchId:current.snapshot?.hotelSearchId,draft:current.draft,selected:current.selected?{quoteId:current.selected.quoteId,version:current.selected.version}:undefined,referralId:hotelReceipt.current?.payload.kind==='hotel'&&JSON.stringify(hotelReceipt.current.payload.quote)===JSON.stringify(current.selected)?hotelReceipt.current.referralId:undefined,scrollTop:document.querySelector<HTMLElement>('[data-hotel-dialog]')?.closest<HTMLElement>('[data-dialog-scroll]')?.scrollTop??0});}
 emitCheckpoint();
 const city=catalog.cities.find(c=>c.id===query.destinationCityId);
 async function openHotel(){
  if(pendingOpen.current||blocked||controller.resetting||!available)return;
  const origin=window.scrollY;const before=controller.currentIntent();
  if(tripKey(before.draft)!==key)return;
  const hasComparison=Boolean(before.committed&&tripKey(before.committed)===key&&before.generation&&before.searchId&&controller.resultIsCurrent(before.generation,before.searchId));
  const token=Symbol('hotel-open');pendingOpen.current=token;
  try{
   if(!hasComparison){
    setOpening(true);
    const started=controller.submit(query,false);
    const expected=controller.currentIntent();const generation=expected.generation,revision=expected.intentRevision;
    await started;
    const latest=controller.currentIntent();
    if(!mounted.current||pendingOpen.current!==token||latest.generation!==generation||latest.intentRevision!==revision||tripKey(latest.draft)!==key||!latest.committed||tripKey(latest.committed)!==key||!latest.generation||!latest.searchId||!controller.resultIsCurrent(latest.generation,latest.searchId))return;
   }
   if(model.openDialog()){onOriginScroll?.(origin);if(!opened.current){retained.current={key,itinerary:actual};opened.current=true;}}
  }finally{if(pendingOpen.current===token){pendingOpen.current=undefined;if(mounted.current)setOpening(false);}}
 }
 const entry=routeReady?<MotionSurface ref={entryRef} purpose={desktop?'dock':'content'} motionKey={key} className={`${styles.entry} ${desktop?styles.dockedEntry:''}`} data-hotel-entry data-hotel-placement={desktop?'map':'inline'}>
  <div className={styles.entryIcon} aria-hidden="true"><svg width="30" height="30" viewBox="0 0 32 32"><path d="M5 28V8h14v20M19 16h8v12M2 28h28M10 13h4m-4 5h4m-4 5h4m9-3h1" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg></div>
  <div><strong><MotionText value={`اقامت در ${city?.name??'مقصد'}`}/></strong><span>اقامتگاه مناسب سفرت را پیدا کن</span></div>
  <Button variant="secondary" aria-label={`مقایسه اقامتگاه‌های ${city?.name??'مقصد'}`} isDisabled={controller.resetting||blocked||controller.pending||controller.startLimitReached} isLoading={opening} onPress={()=>{void openHotel();}}>{desktop?'دیدن اقامتگاه‌ها':`مقایسه اقامتگاه‌های ${city?.name??'مقصد'}`}</Button>
 </MotionSurface>:null;
 return <>{desktop?(portalTarget?createPortal(entry,portalTarget):null):entry}<HotelDialog model={model} catalog={catalog} session={session} canApplyTrip={available} initialScrollTop={restore?.scrollTop} referralAction={flow&&selectedSource?{quoteId:selectedSource.payload.quote.quoteId,node:<ProviderAction compact flow={flow} source={selectedSource} catalog={catalog}/ >}:undefined}/></>;
}
