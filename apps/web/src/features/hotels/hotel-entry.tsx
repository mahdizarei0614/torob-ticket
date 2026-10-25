import {useLayoutEffect,useRef} from 'react';
import type {CatalogSnapshot,HotelQuoteSnapshot,Itinerary,ReferralReceipt,SessionInfo,TransportSearchQuery} from '@torob-ticket/contracts';
import {Button} from '@torob-ticket/ui';
import type {SearchController,TripMapController} from '../map/use-trip-map';
import {HotelDialog} from './hotel-dialog';
import {tripKey,type HotelTrip} from './hotel-state';
import {useHotelDiscovery,type HotelRestore} from './use-hotel-discovery';
import {ProviderAction} from '../referral/referral-dialog';
import type {ReferralSource,useReferralController} from '../referral/referral-controller';
import type {ReturnCheckpoint} from '../referral/return-checkpoint';
import styles from './hotels.module.css';
interface ReferralProps {flow?:ReturnType<typeof useReferralController>;restore?:HotelRestore;onCheckpoint?:(value:ReturnCheckpoint['hotel'])=>void}
export function HotelEntry({controller,map,catalog,session,onCovered,onSelectHotelQuote,flow,restore,onCheckpoint}:{controller:SearchController;map:TripMapController;catalog:CatalogSnapshot;session:SessionInfo;onCovered:(open:boolean)=>void;onSelectHotelQuote?:(quote:HotelQuoteSnapshot|undefined)=>void}&ReferralProps){
 const accepted=useRef<TransportSearchQuery|undefined>(undefined);const s=controller.state;
 if(s.committed&&s.generation&&s.searchId&&controller.resultIsCurrent(s.generation,s.searchId))accepted.current=s.committed;
 if(!accepted.current)return null;
 return <HotelEntryContent controller={controller} map={map} catalog={catalog} session={session} query={accepted.current} onCovered={onCovered} onSelectHotelQuote={onSelectHotelQuote} flow={flow} restore={restore} onCheckpoint={onCheckpoint}/>;
}
function HotelEntryContent({controller,map,catalog,session,query,onCovered,onSelectHotelQuote,flow,restore,onCheckpoint}:{controller:SearchController;map:TripMapController;catalog:CatalogSnapshot;session:SessionInfo;query:TransportSearchQuery;onCovered:(open:boolean)=>void;onSelectHotelQuote?:(quote:HotelQuoteSnapshot|undefined)=>void}&ReferralProps){
 const hotelReceipt=useRef<ReferralReceipt|undefined>(restore?.receipt);const opened=useRef(Boolean(restore));const retained=useRef<{key:string;itinerary?:Itinerary}>({key:tripKey(query)});
 const selection=map.state.selection;const actual=selection&&selection.valid&&Date.parse(selection.quote.expiresAt)>Date.now()&&selection.quote.completeness.status==='complete'&&selection.quote.eligibility.status==='eligible'&&controller.resultIsCurrent(selection.inspection.owner.generation,selection.inspection.owner.searchId)&&tripKey(selection.inspection.query)===tripKey(query)?selection.inspection.itinerary:undefined;
 const key=tripKey(query);
 if(retained.current.key!==key)retained.current={key,itinerary:actual};
 // A valid arrival bound to an already-opened independent stay is a travel fact,
 // not a historical fare. Filter-only refreshes never manufacture a new arrival.
 if(opened.current&&actual)retained.current={key,itinerary:actual};
 if(controller.resetting){opened.current=false;retained.current={key};}
 const draftKey=tripKey(controller.state.draft);
 const available=Boolean(controller.state.committed&&tripKey(controller.state.committed)===key&&draftKey===key&&!controller.resetting);
 const trip:HotelTrip={query,draftKey,available,itinerary:opened.current?retained.current.itinerary:actual};
 const model=useHotelDiscovery({trip,catalog,session,resetting:controller.resetting,onSelectHotelQuote,restore});
 useLayoutEffect(()=>{onCovered(model.open);return()=>onCovered(false);},[model.open,onCovered]);
 function source():ReferralSource|undefined{
  const lease=model.selectionLease();if(!lease)return undefined;
  return {key:'hotel/'+lease.key,payload:{kind:'hotel',quote:lease.quote},isCurrent:lease.isCurrent,accept:fresh=>fresh.kind==='hotel'&&lease.accept(fresh.quote),confirmed:receipt=>{const okay=lease.confirmed(receipt);if(okay){hotelReceipt.current=receipt;emitCheckpoint();}return okay;},refresh:lease.refresh,alternatives:()=>model.state.snapshot?.quotes.filter(q=>q.quoteId!==lease.quote.quoteId).map(q=>({quoteId:q.quoteId,label:`${model.state.snapshot?.hotels.find(h=>h.hotelId===q.hotelId)?.name??'اقامتگاه'} · ${q.total.amountRial/10} تومان برای کل اقامت`,select:()=>{model.selectQuote(q);return source();}}))??[]};
 }
 const selectedSource=source();
 function emitCheckpoint(){const current=model.readState();onCheckpoint?.({open:model.open,hotelSearchId:current.snapshot?.hotelSearchId,draft:current.draft,selected:current.selected?{quoteId:current.selected.quoteId,version:current.selected.version}:undefined,referralId:hotelReceipt.current?.payload.kind==='hotel'&&JSON.stringify(hotelReceipt.current.payload.quote)===JSON.stringify(current.selected)?hotelReceipt.current.referralId:undefined,scrollTop:document.querySelector<HTMLElement>('[data-hotel-dialog]')?.closest<HTMLElement>('[data-dialog-scroll]')?.scrollTop??0});}
 emitCheckpoint();
 const city=catalog.cities.find(c=>c.id===query.destinationCityId);
 return <><div className={styles.entry}>
  <div className={styles.entryIcon} aria-hidden="true"><svg width="30" height="30" viewBox="0 0 32 32"><path d="M5 28V8h14v20M19 16h8v12M2 28h28M10 13h4m-4 5h4m-4 5h4m9-3h1" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg></div>
  <div><strong>اقامت در {city?.name??'مقصد'}</strong><span>هزینه همه اتاق‌ها و شب‌ها را کنار هم ببینید.</span></div>
  <Button variant="secondary" isDisabled={controller.resetting} onPress={()=>{if(model.openDialog()&&!opened.current){retained.current={key,itinerary:actual};opened.current=true;}}}>مقایسه اقامتگاه‌های {city?.name??'مقصد'}</Button>
 </div><HotelDialog model={model} catalog={catalog} session={session} canApplyTrip={available} initialScrollTop={restore?.scrollTop} referralAction={flow&&selectedSource?<ProviderAction flow={flow} source={selectedSource} catalog={catalog}/>:undefined}/></>;
}
