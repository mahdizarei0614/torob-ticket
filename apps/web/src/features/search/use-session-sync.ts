import {useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {apiClient,ClientError} from '@torob-ticket/client';
import type {SessionInfo} from '@torob-ticket/contracts';
export const sessionRevision=(s:SessionInfo)=>JSON.stringify([s.seed,s.anchorInstant,s.fixtureVersion,s.catalogRevision,s.mappingRevision,s.scenarioRevision]);
/** GET-only foreground validation. Changed revision remounts transient selection owners, never starts a search. */
export function useSessionSync(session:SessionInfo|undefined,active:boolean){
 const qc=useQueryClient();const latest=useRef(session);latest.current=session;const[revision,setRevision]=useState(0),[expired,setExpired]=useState(false);
 useEffect(()=>{if(!active||!session||typeof apiClient.currentSession!=='function')return;let live=true;let request:AbortController|undefined;let queued=false;
  const refresh=async()=>{if(document.visibilityState==='hidden')return;if(request){queued=true;return;}const current=latest.current;if(!current)return;request=new AbortController();try{const value=await apiClient.currentSession(request.signal);if(!live)return;if(sessionRevision(current)!==sessionRevision(value)){await qc.cancelQueries({predicate:q=>q.queryKey[0]!=='consumer-bootstrap'});if(!live)return;qc.removeQueries({predicate:q=>q.queryKey[0]!=='consumer-bootstrap'});qc.setQueryData(['consumer-bootstrap'],(old:unknown)=>old&&typeof old==='object'?{...old,session:value}:old);setRevision(x=>x+1);}setExpired(false);}catch(e){if(live&&e instanceof ClientError&&e.api?.code==='SESSION_EXPIRED')setExpired(true);}finally{request=undefined;if(live&&queued){queued=false;void refresh();}}};
  const wake=()=>{void refresh();};window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);wake();return()=>{live=false;request?.abort();window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
 },[active,session?.scenarioRevision,session?.mappingRevision,qc]);return {revision,expired};
}
