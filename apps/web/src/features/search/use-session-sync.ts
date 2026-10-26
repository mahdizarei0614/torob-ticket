import {useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {apiClient,ClientError} from '@torob-ticket/client';
import {serializeSearchUrl} from './search-url';
import type {SessionInfo,TransportSearchQuery} from '@torob-ticket/contracts';
export const sessionRevision=(s:SessionInfo)=>JSON.stringify([s.seed,s.anchorInstant,s.fixtureVersion,s.catalogRevision,s.mappingRevision,s.scenarioRevision]);
/** Immutable receipts/geography remain cached. Only current date inventory is invalidated. */
export async function invalidateSessionInventory(qc:ReturnType<typeof useQueryClient>,owns:()=>boolean=()=>true){
 const affected=(q:{queryKey:readonly unknown[]})=>q.queryKey[0]==='date-prices'&&q.queryKey[2]!=='historical';
 await qc.cancelQueries({predicate:affected});if(!owns())return;qc.removeQueries({predicate:affected});
}
function foregroundRead<T>(controller:AbortController,load:()=>Promise<T>){
 return new Promise<T>((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',stop);};
  const stop=()=>{cleanup();reject(controller.signal.reason==='session-timeout'?new ClientError('network','session-read-timeout'):new DOMException('Aborted','AbortError'));};
  const timer=setTimeout(()=>controller.abort('session-timeout'),5000);controller.signal.addEventListener('abort',stop,{once:true});
  load().then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
 });
}
/** Foreground reads serialize and coalesce to the latest pending request; never bootstrap implicitly. */
export interface RetainedSearchLease {searchId:string;generation:string;query:TransportSearchQuery;isCurrent:()=>boolean}
export function useSessionSync(session:SessionInfo|undefined,active:boolean,retained?:()=>RetainedSearchLease|undefined){
 const sourceReader=useRef(retained);sourceReader.current=retained;
 const qc=useQueryClient(),latest=useRef(session);const propStamp=session?sessionRevision(session):undefined,seenStamp=useRef(propStamp);if(seenStamp.current!==propStamp){seenStamp.current=propStamp;latest.current=session;}
 const [state,setState]=useState({revision:0,expired:false,pending:false,resuming:false,error:undefined as unknown});
 const activeRef=useRef(active);activeRef.current=active;const validationEpoch=useRef(0);const live=useRef(true),resumeLock=useRef(false),cancelRead=useRef<()=>void>(()=>undefined),refreshRef=useRef<()=>void>(()=>undefined);
 function reportExpired(){validationEpoch.current++;cancelRead.current();setState(old=>old.expired?old:{...old,expired:true,revision:old.revision+1,pending:false});}
 async function adopt(value:SessionInfo,force=false,owns:()=>boolean=()=>live.current){
  if(!owns())return;
  const before=latest.current;const changed=force||!before||sessionRevision(before)!==sessionRevision(value);
  let catalog:unknown;
  if(before&&(before.fixtureVersion!==value.fixtureVersion||before.catalogRevision!==value.catalogRevision))catalog=await apiClient.catalogReadonly();
  if(!owns())return;
  if(changed)await invalidateSessionInventory(qc,owns);
  if(!owns())return;
  latest.current=value;
  qc.setQueryData(['consumer-bootstrap'],(old:unknown)=>old&&typeof old==='object'?{...old,session:value,...(catalog?{catalog}:{})}:old);
  setState(old=>({...old,expired:false,error:undefined,...(changed?{revision:old.revision+1}:{})}));
 }
 const adoptRef=useRef(adopt);adoptRef.current=adopt;
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{
  if(!active||!session||typeof apiClient.currentSession!=='function')return;
  let valid=true,request:AbortController|undefined,queued=false;
  const refresh=async()=>{
   if(document.visibilityState==='hidden')return;if(request){queued=true;return;}
   const epoch=validationEpoch.current;request=new AbortController();setState(old=>({...old,pending:true}));
   try{const controller=request;const value=await foregroundRead(controller,()=>apiClient.currentSession(controller.signal));
    const owns=()=>valid&&activeRef.current&&!controller.signal.aborted&&epoch===validationEpoch.current;
    if(!owns())return;
    const source=sourceReader.current?.();
    if(latest.current&&sessionRevision(latest.current)===sessionRevision(value)&&source?.isCurrent()){
     const sourceOwns=()=>owns()&&source.isCurrent()&&!!latest.current&&sessionRevision(latest.current)===sessionRevision(value);
     try{
      const receipt=await foregroundRead(controller,()=>apiClient.snapshot(source.searchId,controller.signal));
      if(!sourceOwns())return;
      if(receipt.snapshot.searchId!==source.searchId||receipt.snapshot.clientGeneration!==source.generation||serializeSearchUrl(receipt.snapshot.query)!==serializeSearchUrl(source.query))throw new ClientError('schema','retained-source-binding');
     }catch(error){
      if(!sourceOwns())return;
      if(error instanceof ClientError&&error.api?.code==='NOT_FOUND'){await adoptRef.current(value,true,sourceOwns);return;}
      throw error;
     }
    }
    if(owns())await adoptRef.current(value,false,owns);}
   catch(error){if(valid&&(!request.signal.aborted||request.signal.reason==='session-timeout')&&epoch===validationEpoch.current){if(error instanceof ClientError&&error.api?.code==='SESSION_EXPIRED')reportExpired();else setState(old=>({...old,error}));}}
   finally{request=undefined;if(valid){setState(old=>({...old,pending:false}));if(queued){queued=false;void refresh();}}}
  };
  const wake=()=>{void refresh();};refreshRef.current=wake;cancelRead.current=()=>request?.abort();
  window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);wake();
  return()=>{valid=false;request?.abort();refreshRef.current=()=>undefined;window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
 },[active,Boolean(session),qc]);
 async function resume(){
  if(resumeLock.current)return;validationEpoch.current++;cancelRead.current();resumeLock.current=true;setState(old=>({...old,resuming:true,error:undefined}));
  try{const epoch=validationEpoch.current;const value=await apiClient.session();await adoptRef.current(value,true,()=>live.current&&activeRef.current&&epoch===validationEpoch.current);}
  catch(error){if(live.current)setState(old=>({...old,error}));}
  finally{resumeLock.current=false;if(live.current)setState(old=>({...old,resuming:false}));}
 }
 return {...state,reportExpired,resume,refresh:()=>refreshRef.current()};
}
