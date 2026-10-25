import {useLayoutEffect,useRef,useState,useEffect} from 'react';
import type {CatalogSnapshot,Itinerary,QuoteSnapshot,ReferralReceipt} from '@torob-ticket/contracts';
import type {CameraIntent} from '@torob-ticket/graphics/host';
import type {useSearchController} from '../search/use-search-controller';
import type {QuoteSelection} from '../results/results-reducer';
import {contextKey,createMapState,mapReducer,mapView,reconcileMapState,type MapAction,type MapContext,type MapInspection,type MapOwner} from './map-state';
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
 const owner=search.generation&&search.searchId?{generation:search.generation,searchId:search.searchId}:undefined;
 const owns=(expected:MapOwner|undefined)=>Boolean(expected&&controller.resultIsCurrent(expected.generation,expected.searchId));
 function inspection(itinerary:Itinerary,expected:MapOwner):MapInspection|undefined {const query=readContext().committed;return query&&owns(expected)?{itinerary,query,owner:expected}:undefined;}
 function preview(itinerary?:Itinerary,source:'hover'|'focus'='hover',leavingId?:string) {if(!owns(owner)||!owner)return;const item=itinerary?inspection(itinerary,owner):undefined;if(itinerary&&!item)return;const next=send({type:'preview',owner,inspection:item,source,leavingId});controller.previewResultItinerary(next.preview?.itinerary.itineraryId,owner.generation,owner.searchId);}
 function pin(itinerary:Itinerary) {if(!owns(owner)||!owner)return;const item=inspection(itinerary,owner);if(!item)return;controller.pinResultItinerary(itinerary.itineraryId,owner.generation,owner.searchId);send({type:'pin',inspection:item});}
 function selection(quote?:QuoteSnapshot,itinerary?:Itinerary,intent?:QuoteSelection) {if(!owns(owner)||!owner)return;const item=itinerary?inspection(itinerary,owner):undefined;current.current=reconcileMapState(current.current,readContext());if(quote&&item&&intent&&intent!==current.current.resultIntent&&current.current.pin?.itinerary.itineraryId!==itinerary?.itineraryId){controller.pinResultItinerary(item.itinerary.itineraryId,owner.generation,owner.searchId);send({type:'pin',inspection:item});}send({type:'selection',owner,inspection:item,quote,intent});}
 const lease=controller.dateInteractions.capture();const fitKey=String(state.fitEpoch);
 const sceneKey=(value=mapView(current.current,Date.now()))=>[current.current.fitEpoch,value.itinerary?.itineraryId??'illustrative:'+value.query.originCityId+':'+value.query.destinationCityId,value.direction,current.current.projection.centralLongitude].join('|');
 const renderedSceneKey=sceneKey(view);
 const camera=useRef<{key:string;value:CameraIntent}|undefined>(undefined);
 function mapCurrent(){return controller.dateInteractions.isCurrent(lease)&&String(current.current.fitEpoch)===fitKey&&sceneKey()===renderedSceneKey&&!controller.resetting;}
 function saveCamera(value:CameraIntent) {if(mapCurrent())camera.current={key:fitKey,value:{...value}};}
 function direction(value:'outbound'|'return'){if(mapCurrent())send({type:'direction',direction:value});}
 function clear(){if(!mapCurrent())return;controller.clearMapInspection(lease);send({type:'clear-inspection'});}
 function chooseCity(target:'origin'|'destination',id:string) {if(!mapCurrent())return;const routes=catalog.supportedConnections.filter(route=>route.mode===readContext().draft.mode&&route.scope===readContext().draft.scope);const allowed=routes.some(route=>target==='origin'?route.originCityId===id:route.originCityId===readContext().draft.originCityId&&route.destinationCityId===id);if(allowed)controller.edit(target==='origin'?{originCityId:id}:{destinationCityId:id});}
 /** T22 calls this only with its server recheck quote after ready or explicit changed-version acceptance. */
 function bindAcceptedQuote(previous:{quoteId:string;version:number},quote:QuoteSnapshot,itinerary:Itinerary) {if(!owns(owner)||!owner)return;send({type:'bind-rechecked',owner,previous,quote,itinerary,now:Date.now()});}
 /** T22 supplies its actual server-confirmed receipt; there is no user-facing completion simulator. */
 function confirmReferral(receipt:ReferralReceipt) {if(!owns(owner)||!owner)return;send({type:'confirm',owner,receipt,now:Date.now()});}
 return {state,view,preview,pin,selection,direction,clear,chooseCity,fitKey,lease,sceneKey:renderedSceneKey,isCurrent:mapCurrent,saveCamera,initialCamera:camera.current?.key===fitKey?camera.current.value:undefined,bindAcceptedQuote,confirmReferral};
}
export type TripMapController=ReturnType<typeof useTripMap>;
