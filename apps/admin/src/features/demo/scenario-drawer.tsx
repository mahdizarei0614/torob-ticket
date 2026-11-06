import {useState} from 'react';
import {DemoScenarioSchema} from '@torob-ticket/contracts';
import {adminClient} from '@torob-ticket/client';
import {Dialog} from '@torob-ticket/ui';
import {useAdmin} from '../../admin-state';
import s from '../../operations.module.css';
const names:Record<string,string>={'normal':'Normal service','slow-provider':'Slow response','provider-timeout':'Provider timeout','price-change':'Price change at recheck','sold-out':'Sold out at recheck','conflicting-data':'Conflicting source data','no-eligible-results':'No eligible offers'};
export function ScenarioDrawer(){
 const{config,busy,run,reset,error}=useAdmin();
 const[open,setOpen]=useState(false),[confirm,setConfirm]=useState(false),[loadingHistory,setLoadingHistory]=useState(false);
 async function loadHistory(){setLoadingHistory(true);try{await run(()=>adminClient.populateTraffic(),()=>setOpen(false));}finally{setLoadingHistory(false);}}
 return <>
  <button onClick={()=>setOpen(true)}>Configuration</button>
  <Dialog isOpen={open} language="en" onOpenChange={next=>{if(!busy){setOpen(next);setConfirm(false);}}} title="Operational configuration">
   <p>Changes apply to your current session. Active affected work stops; new searches use the new revision. Recorded evidence remains available.</p>
   <label className={s.field}>Service profile<select aria-label="Service profile" value={config?.session.scenario??'normal'} disabled={busy||!config} onChange={e=>{const scenario=DemoScenarioSchema.parse(e.target.value);if(config)void run(()=>adminClient.setScenario({baseRevision:config.revision,scenario}));}}>{DemoScenarioSchema.options.map(x=><option key={x} value={x}>{names[x]}</option>)}</select></label>
   <p className={s.muted}>Revision <code>{config?.revision??'Loading'}</code></p>
   <hr/>
   <section aria-labelledby="activity-history-heading">
    <h3 id="activity-history-heading">Referral activity</h3>
    <p>Load three months of referral history and monthly provider pricing. Existing activity and pricing are preserved.</p>
    <button disabled={busy||!config} onClick={()=>{void loadHistory();}}>{loadingHistory?'Loading activity…':'Load activity history'}</button>
    {error&&<p role="alert">{error}</p>}
   </section>
   <hr/>
   {confirm?<div role="group" aria-label="Confirm session reset"><p>Clear this session’s searches, referrals, saved searches, account and overrides? Other sessions and base inventory are preserved.</p><div className={s.actions}><button className={s.danger} disabled={busy} onClick={()=>{void reset().then(()=>setConfirm(false));}}>Reset this session</button><button disabled={busy} onClick={()=>setConfirm(false)}>Keep session</button></div></div>:<button disabled={busy||!config} onClick={()=>setConfirm(true)}>Reset session…</button>}
  </Dialog>
 </>;
}
