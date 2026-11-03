import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Dialog} from '@torob-ticket/ui';
import {adminClient,ClientError} from '@torob-ticket/client';
import type {ProviderTariff} from '@torob-ticket/contracts';
import {errorText} from '../../admin-state';
import {parseTariffDraft,tariffDraft,type TariffDraftRow} from './traffic-format';
import s from './traffic.module.css';

export function ProviderPricing({tariff,name,onClose,onSaved,onRefresh}:{tariff:ProviderTariff;name:string;onClose:()=>void;onSaved:()=>void;onRefresh:()=>void}){
 const[rows,setRows]=useState(()=>tariffDraft(tariff)),[error,setError]=useState(''),[saving,setSaving]=useState(false),[conflict,setConflict]=useState(false);
 const live=useRef(true),locked=useRef(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 function update(index:number,field:keyof TariffDraftRow,value:string){setError('');setRows(previous=>previous.map((row,i)=>i===index?{...row,[field]:value}:row));}
 async function save(event:FormEvent){
  event.preventDefault();if(locked.current)return;setError('');setConflict(false);
  let input;try{input=parseTariffDraft(tariff.revision,rows);}catch(e){setError(errorText(e));return;}
  locked.current=true;setSaving(true);
  try{await adminClient.setProviderTariff(tariff.providerId,input);if(live.current)onSaved();}
  catch(e){if(live.current){const stale=e instanceof ClientError&&e.api?.code==='IDEMPOTENCY_CONFLICT';setConflict(stale);setError(stale?'Pricing changed. Close and refresh pricing before reopening the editor. Your entered rates remain visible here.':errorText(e));}}
  finally{locked.current=false;if(live.current)setSaving(false);}
 }
 return <Dialog title={`Referral pricing · ${name}`} language="en" isOpen onOpenChange={open=>{if(!open&&!locked.current)onClose();}} isDismissable={!saving}>
  <form className={s.tariff} onSubmit={event=>{void save(event);}}>
   <p>Set the fee per billable referral. The first rate applies through the first checkpoint; each later rate applies only above the previous checkpoint. The count restarts each Persian calendar month in Tehran time.</p>
   <p className={s.note}>Repeat visits by the same visitor session to this provider within 60 minutes are not billed again. New rates apply to future billable referrals. Earlier priced and unpriced records stay unchanged.</p>
   <table aria-label="Graduated referral pricing"><thead><tr><th scope="col">Monthly checkpoint</th><th scope="col">Fee per referral · toman</th><th scope="col"><span className={s.unlimited}>Edit</span></th></tr></thead><tbody>
    {rows.map((row,index)=><tr key={index}>
     <td>{index===rows.length-1?<span className={s.unlimited}>{index===0?'All referrals':`Above ${rows[index-1]!.upTo||'previous checkpoint'}`}</span>:<label><span className={s.note}>Up to</span><input aria-label={`Checkpoint ${index+1}`} inputMode="numeric" maxLength={16} value={row.upTo} onChange={event=>update(index,'upTo',event.target.value)} disabled={saving}/></label>}</td>
     <td><input aria-label={`Tier ${index+1} fee in toman`} inputMode="decimal" maxLength={18} value={row.rateToman} placeholder="Rate not set" onChange={event=>update(index,'rateToman',event.target.value)} disabled={saving}/></td>
     <td>{index<rows.length-1&&<button className={s.remove} type="button" aria-label={`Remove checkpoint ${index+1}`} disabled={saving} onClick={()=>{setError('');setRows(previous=>previous.filter((_,i)=>i!==index));}}>×</button>}</td>
    </tr>)}
   </tbody></table>
   <p className={s.note}>Leave a rate empty to keep it unset. Enter 0 for a free tier. Rates support one decimal toman, equal to one rial.</p>
   {error&&<div className={s.error} role="alert"><p>{error}</p>{conflict&&<button type="button" onClick={onRefresh}>Close and refresh pricing</button>}</div>}
   <div className={s.tariffActions}><button type="button" disabled={saving||rows.length>=12} onClick={()=>{setError('');setRows(previous=>[...previous.slice(0,-1),{upTo:'',rateToman:''},previous.at(-1)!]);}}>Add checkpoint</button><div><button type="button" disabled={saving} onClick={onClose}>Cancel</button>{' '}<button className={s.save} disabled={saving} type="submit">{saving?'Saving…':'Save future rates'}</button></div></div>
  </form>
 </Dialog>;
}
