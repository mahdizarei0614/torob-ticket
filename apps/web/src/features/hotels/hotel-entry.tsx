import {useLayoutEffect,useRef} from 'react';
import type {CatalogSnapshot,HotelQuoteSnapshot,Itinerary,SessionInfo,TransportSearchQuery} from '@torob-ticket/contracts';
import {Button} from '@torob-ticket/ui';
import type {SearchController,TripMapController} from '../map/use-trip-map';
import {HotelDialog} from './hotel-dialog';
import {tripKey,type HotelTrip} from './hotel-state';
import {useHotelDiscovery} from './use-hotel-discovery';
import styles from './hotels.module.css';
export function HotelEntry({controller,map,catalog,session,onCovered,onSelectHotelQuote}:{controller:SearchController;map:TripMapController;catalog:CatalogSnapshot;session:SessionInfo;onCovered:(open:boolean)=>void;onSelectHotelQuote?:(quote:HotelQuoteSnapshot|undefined)=>void}){
 const accepted=useRef<TransportSearchQuery|undefined>(undefined);const s=controller.state;
 if(s.committed&&s.generation&&s.searchId&&controller.resultIsCurrent(s.generation,s.searchId))accepted.current=s.committed;
 if(!accepted.current)return null;
 return <HotelEntryContent controller={controller} map={map} catalog={catalog} session={session} query={accepted.current} onCovered={onCovered} onSelectHotelQuote={onSelectHotelQuote}/>;
}
function HotelEntryContent({controller,map,catalog,session,query,onCovered,onSelectHotelQuote}:{controller:SearchController;map:TripMapController;catalog:CatalogSnapshot;session:SessionInfo;query:TransportSearchQuery;onCovered:(open:boolean)=>void;onSelectHotelQuote?:(quote:HotelQuoteSnapshot|undefined)=>void}){
 const opened=useRef(false);const retained=useRef<{key:string;itinerary?:Itinerary}>({key:tripKey(query)});
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
 const model=useHotelDiscovery({trip,catalog,session,resetting:controller.resetting,onSelectHotelQuote});
 useLayoutEffect(()=>{onCovered(model.open);return()=>onCovered(false);},[model.open,onCovered]);
 const city=catalog.cities.find(c=>c.id===query.destinationCityId);
 return <><div className={styles.entry}>
  <div className={styles.entryIcon} aria-hidden="true"><svg width="30" height="30" viewBox="0 0 32 32"><path d="M5 28V8h14v20M19 16h8v12M2 28h28M10 13h4m-4 5h4m-4 5h4m9-3h1" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg></div>
  <div><strong>اقامت در {city?.name??'مقصد'}</strong><span>هزینه همه اتاق‌ها و شب‌ها را کنار هم ببینید.</span></div>
  <Button variant="secondary" isDisabled={controller.resetting} onPress={()=>{if(!opened.current){retained.current={key,itinerary:actual};opened.current=true;}model.openDialog();}}>مقایسه اقامتگاه‌های {city?.name??'مقصد'}</Button>
 </div><HotelDialog model={model} catalog={catalog} session={session} canApplyTrip={available}/></>;
}
