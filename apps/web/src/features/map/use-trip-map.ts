import {useLayoutEffect,useRef,useState,useEffect} from 'react';
import type {CatalogSnapshot,Itinerary,QuoteSnapshot,ReferralReceipt} from '@torob-ticket/contracts';
import type {CameraIntent} from '@torob-ticket/graphics/host';
import type {useSearchController} from '../search/use-search-controller';
import type {QuoteSelection} from '../results/results-reducer';
import {contextKey,createMapState,mapReducer,mapView,mapPresentationView,reconcileMapState,type MapAction,type MapContext,type MapInspection,type MapOwner} from './map-state';
export type SearchController=ReturnType<typeof useSearchController>;
export function useTripMap(controller:SearchController,catalog:CatalogSnapshot) {
 const search=controller.state;
 function readContext():MapContext {const intent=controller.currentIntent();return {draft:intent.draft,committed:intent.committed,generation:intent.generation,searchId:intent.searchId,current:Boolean(intent.generation&&intent.searchId&&controller.resultIsCurrent(intent.generation,intent.searchId)),resetting:controller.resetting,revision:intent.intentRevision,cause:intent.intentCause,places:catalog.places};}
 const context=readContext();const stamp=contextKey(context);
 const [stored,setStored]=useState(()=>createMapState(context));const state=reconcileMapState(stored,context);const current=useRef(state);current.current=state;
 const [,tick]=useState(0);
 useLayoutEffect(()=>{const next=reconcileMapState(current.current,readContext());if(next!==stored){current.current=next;setStored(next);}},[stamp]);
 function send(action:MapAction) {const base=reconcileMapState(current.current,readContext());const next=mapReducer(base,action);current.current=next;setStored(next);return next;}
 useEffect(()=>{const expiry=state.selection?.quote.expiresAt;if(!expiry)return;const remaining=Date.parse(expiry)-Date.now();if(remaining<=0)return;const timer=setTimeout(()=>tick(value=>value+1),remaining);return()=>clearTimeout(timer);},[state.selection?.quote]);
 const view=mapView(state,Date.now());
 const presentationView=mapPresentationView(state,Date.now());
 const owner=search.generation&&search.searchId?{generation:search.generation,searchId:search.searchId}:undefined;
 const owns=(expected:MapOwner|undefined)=>Boolean(expected&&controller.resultIsCurrent(expected.generation,expected.searchId));
 function inspection(itinerary:Itinerary,expected:MapOwner):MapInspection|undefined {const query=readContext().committed;return query&&owns(expected)?{itinerary,query,owner:expected}:undefined;}
 function preview(itinerary?:Itinerary,source:'hover'|'focus'='hover',leavingId?:string) {if(!owns(owner)||!owner)return;const item=itinerary?inspection(itinerary,owner):undefined;if(itinerary&&!item)return;const next=send({type:'preview',owner,inspection:item,source,leavingId});controller.previewResultItinerary(next.preview?.itinerary.itineraryId,owner.generation,owner.searchId);}
 function pin(itinerary:Itinerary) {if(!owns(owner)||!owner)return;const item=inspection(itinerary,owner);if(!item)return;controller.pinResultItinerary(itinerary.itineraryId,owner.generation,owner.searchId);send({type:'pin',inspection:item});}
 function selection(quote?:QuoteSnapshot,itinerary?:Itinerary,intent?:QuoteSelection) {if(!owns(owner)||!owner)return;const item=itinerary?inspection(itinerary,owner):undefined;current.current=reconcileMapState(current.current,readContext());if(quote&&item&&intent&&intent!==current.current.resultIntent&&current.current.pin?.itinerary.itineraryId!==itinerary?.itineraryId){controller.pinResultItinerary(item.itinerary.itineraryId,owner.generation,owner.searchId);send({type:'pin',inspection:item});}send({type:'selection',owner,inspection:item,quote,intent});}
 const lease=controller.dateInteractions.capture();const fitKey=String(state.fitEpoch);
 const sceneKey=(value=mapView(current.current,Date.now()))=>[current.current.fitEpoch,value.itinerary?.itineraryId??'illustrative:'+value.query.originCityId+':'+value.query.destinationCityId,value.direction,current.current.projection.centralLongitude].join('|');
 const renderedSceneKey=sceneKey(view);
 const presentationSceneKey=sceneKey(presentationView);
 const camera=useRef<{key:string;value:CameraIntent}|undefined>(undefined);
 function mapCurrent(){return controller.dateInteractions.isCurrent(lease)&&String(current.current.fitEpoch)===fitKey&&sceneKey()===renderedSceneKey&&!controller.resetting;}
 function isPresentationCurrent(){return controller.dateInteractions.isCurrent(lease)&&String(current.current.fitEpoch)===fitKey&&sceneKey(mapPresentationView(current.current,Date.now()))===presentationSceneKey&&!controller.resetting;}
 function saveCamera(value:CameraIntent) {if(mapCurrent())camera.current={key:fitKey,value:{...value}};}
 function savePresentationCamera(value:CameraIntent) {if(isPresentationCurrent())camera.current={key:fitKey,value:{...value}};}
 function direction(value:'outbound'|'return'){if(mapCurrent())send({type:'direction',direction:value});}
 function clear(){if(!mapCurrent())return;controller.clearMapInspection(lease);send({type:'clear-inspection'});}

 /** T22 calls this only with its server recheck quote after ready or explicit changed-version acceptance. */
 function bindAcceptedQuote(previous:{quoteId:string;version:number},quote:QuoteSnapshot,itinerary:Itinerary) {if(!owns(owner)||!owner)return false;const next=send({type:'bind-rechecked',owner,previous,quote,itinerary,now:Date.now()});return next.selection?.quote.version===quote.version&&next.selection.quote.quoteId===quote.quoteId;}
 /** T22 supplies its actual server-confirmed receipt; there is no user-facing completion simulator. */
 function confirmReferral(receipt:ReferralReceipt) {if(!owns(owner)||!owner)return false;const next=send({type:'confirm',owner,receipt,now:Date.now()});return next.receipt?.referralId===receipt.referralId;}
 function hydrateReceipt(origin:QuoteSnapshot,itinerary:Itinerary,receipt:ReferralReceipt){if(!owns(owner)||!owner)return false;const next=send({type:'hydrate-receipt',owner,origin,itinerary,receipt,now:Date.now()});return next.receipt?.referralId===receipt.referralId;}
 function selectionCurrent(id:string){return Boolean(current.current.selection?.quote.quoteId===id&&owns(current.current.selection.inspection.owner)&&controller.currentIntent().intentRevision===context.revision);}
 function referralLease(){
  const selected=current.current.selection;if(!selected||!selected.valid||!owns(selected.inspection.owner))return undefined;let expected=selected.quote;const revision=controller.currentIntent().intentRevision;
  const isCurrent=()=>Boolean(current.current.selection?.quote===expected&&current.current.selection.valid&&owns(selected.inspection.owner)&&controller.currentIntent().intentRevision===revision);
  const accept=(quote:QuoteSnapshot,itinerary:Itinerary)=>{if(!isCurrent())return false;const okay=bindAcceptedQuote({quoteId:expected.quoteId,version:expected.version},quote,itinerary);if(okay)expected=current.current.selection!.quote;return okay;};
  const confirmed=(receipt:ReferralReceipt)=>isCurrent()&&confirmReferral(receipt);
  return {quote:expected,itinerary:selected.inspection.itinerary,key:[selected.inspection.owner.generation,selected.inspection.owner.searchId,revision,expected.quoteId,expected.version].join('/'),isCurrent,accept,confirmed};
 }
 function restoreUi(value:{pin?:Itinerary;origin?:QuoteSnapshot;receipt?:ReferralReceipt;intent?:QuoteSelection;direction:'outbound'|'return';camera?:CameraIntent}){
  if(!owner||!owns(owner))return;
  if(value.pin){const item=inspection(value.pin,owner);if(item)send({type:'pin',inspection:item});}
  if(value.origin&&value.pin){selection(value.origin,value.pin,value.intent);if(value.receipt)hydrateReceipt(value.origin,value.pin,value.receipt);}
  send({type:'direction',direction:value.direction});if(value.camera)camera.current={key:String(current.current.fitEpoch),value:{...value.camera}};
 }
 return {referralLease,restoreUi,readState:()=>current.current,readCamera:()=>camera.current?.key===String(current.current.fitEpoch)?camera.current.value:undefined,hydrateReceipt,selectionCurrent,state,view,presentationView,presentationSceneKey,isPresentationCurrent,savePresentationCamera,preview,pin,selection,direction,clear,fitKey,lease,sceneKey:renderedSceneKey,isCurrent:mapCurrent,saveCamera,initialCamera:camera.current?.key===fitKey?camera.current.value:undefined,bindAcceptedQuote,confirmReferral};
}
export type TripMapController=ReturnType<typeof useTripMap>;
