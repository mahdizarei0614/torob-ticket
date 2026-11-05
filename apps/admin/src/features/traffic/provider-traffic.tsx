import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router';
import {adminClient} from '@torob-ticket/client';
import {displayProviderName,ProviderMark} from '@torob-ticket/ui';
import type {ProviderTariff,ProviderTraffic} from '@torob-ticket/contracts';
import {useAdmin,useAdminData} from '../../admin-state';
import {DataState,Pager} from '../../components';
import {ProviderPricing} from './provider-pricing';
import {count,customRange,dayLabel,fee,monthLabel,previousMonth,trafficStamp as stamp} from './traffic-format';
import base from '../../operations.module.css';
import s from './traffic.module.css';

type ProviderRow=ProviderTraffic['providers'][number];
function FeeTotal({counts}:{counts:ProviderTraffic['totals']}){
 return <div className={s.feeCell}><span>{counts.unpricedBillable&&counts.billable===counts.unpricedBillable?'Unpriced':`${fee(counts.knownFeeRial)}${counts.unpricedBillable?' priced':''}`}</span>{counts.unpricedBillable>0&&<small>{count(counts.unpricedBillable)} referrals had no rate when recorded</small>}</div>;
}
function Checkpoint({row,month,current}:{row:ProviderRow;month:string;current:boolean}){
 // The current tariff is prospective. It must never reconstruct historical
 // tier positions or fees from a closed month's count.
 if(!current)return <div className={s.checkpoint}><span>{count(row.billingMonthBillable)} billable in {month}</span><small>Closed month · fees use recorded rates</small></div>;
 const index=row.tariff.tiers.findIndex(tier=>tier.upTo===null||row.billingMonthBillable<tier.upTo),tier=row.tariff.tiers[Math.max(0,index)]!;
 const prior=index>0?row.tariff.tiers[index-1]!.upTo??0:0;
 return <div className={s.checkpoint}><span>Next billable referral · tier {Math.max(0,index)+1} · {tier.rateRial===null?'Rate not set':fee(tier.rateRial)}</span>{tier.upTo!==null&&<progress aria-label={`${month}: ${count(row.billingMonthBillable)} billable referrals, next checkpoint ${count(tier.upTo)}`} value={Math.max(0,row.billingMonthBillable-prior)} max={tier.upTo-prior}/>}
  <small>{count(row.billingMonthBillable)} billable this month · all types{tier.upTo!==null?` · next rate above ${count(tier.upTo)}`:' · unlimited tier'}</small>
 </div>;
}
function DailyTrend({daily}:{daily:ProviderTraffic['daily']}){
 const maximum=Math.max(1,...daily.map(day=>day.counts.outbound)),width=720,height=150,step=width/Math.max(1,daily.length),barWidth=Math.max(1,Math.min(18,step*.7));
 return <div className={s.trend}>
  <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Daily outbound and billable referrals, ${daily.length} days`}>
   {[0,1,2].map(i=><line key={i} x1="0" x2={width} y1={12+i*63} y2={12+i*63} className={s.trendGrid}/>)}
   {daily.map((day,index)=>{const x=step*(index+.5)-barWidth/2,totalHeight=day.counts.outbound/maximum*126,billedHeight=day.counts.billable/maximum*126;return <g key={day.date}><title>{dayLabel(day.date)}: {count(day.counts.outbound)} outbound, {count(day.counts.billable)} billable</title><rect className={s.bar} x={x} y={138-totalHeight} width={barWidth} height={totalHeight}/><rect className={s.billableBar} x={x} y={138-billedHeight} width={Math.max(1,barWidth*.35)} height={billedHeight}/></g>;})}
  </svg>
  <div className={s.trendAxis}><span>{daily[0]?dayLabel(daily[0].date):''}</span><span>Daily maximum: {count(Math.max(0,...daily.map(day=>day.counts.outbound)))}</span><span>{daily.at(-1)?dayLabel(daily.at(-1)!.date):''}</span></div>
  <details className={base.json}><summary>View daily counts</summary><div className={base.tableWrap}><table aria-label="Daily referral counts"><thead><tr><th>Date · Tehran</th><th>Outbound</th><th>Billable</th><th>Repeats</th></tr></thead><tbody>{daily.map(day=><tr key={day.date}><th scope="row">{dayLabel(day.date)}</th><td>{count(day.counts.outbound)}</td><td>{count(day.counts.billable)}</td><td>{count(day.counts.repeats)}</td></tr>)}</tbody></table></div></details>
 </div>;
}

export function ProviderTrafficDashboard(){
 const{catalog,epoch,refresh,config,busy}=useAdmin();
 const[month,setMonth]=useState(''),[providerId,setProvider]=useState(''),[kind,setKind]=useState<''|'transport'|'hotel'>(''),[offset,setOffset]=useState(0),[sort,setSort]=useState('outbound');
 const[custom,setCustom]=useState(false),[from,setFrom]=useState(''),[through,setThrough]=useState(''),[range,setRange]=useState<{from:string;to:string}|undefined>(),[rangeError,setRangeError]=useState('');
 const[editing,setEditing]=useState<ProviderTariff>();
 const[knownMonths,setKnownMonths]=useState<string[]>([]),[lastMonth,setLastMonth]=useState('');
 useEffect(()=>setEditing(undefined),[epoch]);
 const query={month:month||undefined,providerId:providerId||undefined,kind:kind||undefined,from:range?.from,to:range?.to,offset,limit:25};
 const q=useAdminData(['traffic',month,providerId,kind,range?.from,range?.to,offset],signal=>adminClient.traffic(query,signal));
 const d=q.data,name=(id:string)=>displayProviderName(catalog?.providerCapabilities.find(provider=>provider.providerId===id));
 useEffect(()=>{if(d){setLastMonth(d.period.monthKey);setKnownMonths(d.availableMonths);}},[d]);
 const sorted=useMemo(()=>[...(d?.providers??[])].sort((a,b)=>(sort==='fees'?b.counts.knownFeeRial-a.counts.knownFeeRial:sort==='billable'?b.counts.billable-a.counts.billable:b.counts.outbound-a.counts.outbound)||a.providerId.localeCompare(b.providerId)),[d?.providers,sort]);
 const activeMonth=month||d?.period.monthKey||lastMonth;
 const months=[...new Set([...knownMonths,...(d?.availableMonths??[]),...(activeMonth?[activeMonth]:[])])].sort().reverse();
 function selectMonth(next:string){setMonth(next);setRange(undefined);setFrom('');setThrough('');setRangeError('');setCustom(false);setOffset(0);}
 return <>
  <header className={s.title}><div><h1>Provider traffic</h1><p>Visitors sent to each provider, billable referrals and their fees.</p></div><Link to="/referrals">Inspect referral records →</Link></header>
  <div className={s.toolbar} aria-label="Traffic filters">
   <label>Billing month<select value={activeMonth} disabled={!activeMonth||busy} onChange={event=>selectMonth(event.target.value)}>{!activeMonth&&<option value="">Loading month…</option>}{months.map(value=><option key={value} value={value}>{monthLabel(value)}</option>)}</select></label>
   <div className={s.periodActions}><button type="button" disabled={!config||busy} onClick={()=>{selectMonth('');refresh();}}>Current month</button><button type="button" disabled={!activeMonth||busy} onClick={()=>selectMonth(previousMonth(activeMonth))}>Previous month</button><button type="button" aria-expanded={custom} onClick={()=>setCustom(value=>!value)}>Custom dates</button></div>
   <label>Provider<select value={providerId} onChange={event=>{setProvider(event.target.value);setOffset(0);}}><option value="">All providers</option>{catalog?.providerCapabilities.map(provider=><option key={provider.providerId} value={provider.providerId}>{displayProviderName(provider)}</option>)}</select></label>
   <label>Referral type<select value={kind} onChange={event=>{setKind(event.target.value as typeof kind);setOffset(0);}}><option value="">All types</option><option value="transport">Transport</option><option value="hotel">Hotel</option></select></label>
  </div>
  {custom&&<form className={s.rangeForm} onSubmit={event=>{event.preventDefault();try{const next=customRange(from,through);setRange(next.from&&next.to?{from:next.from,to:next.to}:undefined);setRangeError('');setOffset(0);}catch(e){setRangeError(e instanceof Error?e.message:'Check the date range.');}}}>
   <p>Filter dates within the selected Persian billing month. Dates use Tehran time; the through date is included.</p><label>From date<input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>Through date<input type="date" value={through} onChange={event=>setThrough(event.target.value)}/></label><button type="submit">Apply dates</button><button type="button" onClick={()=>{setRange(undefined);setFrom('');setThrough('');setRangeError('');setOffset(0);}}>Clear dates</button>{rangeError&&<p role="alert" className={s.error}>{rangeError}</p>}
  </form>}
  <DataState loading={q.isPending} error={q.error} hasEvidence={Boolean(d)}>{d&&<>
   <div className={s.metrics} aria-label="Traffic totals">
    <article className={s.metric}><span>Outbound referrals</span><strong className={s.number}>{count(d.totals.outbound)}</strong><small>{count(d.totals.transport)} transport · {count(d.totals.hotel)} hotel</small></article>
    <article className={s.metric}><span><abbr title="Distinct browser sessions in the selected scope; signing in or out does not create a new visitor. This is not a verified-person count.">Unique visitor sessions</abbr></span><strong className={s.number}>{count(d.totals.uniqueVisitorSessions)}</strong><small>Across the selected providers and dates</small></article>
    <article className={s.metric}><span>Billable referrals</span><strong className={s.number}>{count(d.totals.billable)}</strong><small>{count(d.totals.repeats)} repeat visits excluded · 60-minute window</small></article>
    <article className={s.metric}><span>{d.totals.unpricedBillable?'Priced referral fees':'Referral fees'}</span><strong className={s.number}>{d.totals.unpricedBillable===d.totals.billable&&d.totals.unpricedBillable>0?'Unpriced':fee(d.totals.knownFeeRial)}</strong><small>{d.totals.unpricedBillable?`${count(d.totals.unpricedBillable)} referrals had no rate when recorded`:'Recorded fees from configured rates'}</small></article>
   </div>
   <p className={s.note}>{monthLabel(d.period.monthKey)} · {stamp(d.period.from)} to {stamp(d.period.to)} · Tehran time. Summary, trend and provider totals use the same filters.</p>
   <section className={s.section} aria-labelledby="provider-traffic-heading">
    <div className={s.sectionHeader}><div><h2 id="provider-traffic-heading">Traffic by provider</h2><p>Monthly checkpoints use all billable referral types for this provider; activity columns respect the filters above.</p></div><label>Sort by<select value={sort} onChange={event=>setSort(event.target.value)}><option value="outbound">Outbound referrals</option><option value="billable">Billable referrals</option><option value="fees">Priced fees</option></select></label></div>
    <div className={base.tableWrap}><table aria-label="Provider referral traffic"><thead><tr><th scope="col">Provider</th><th scope="col">Outbound</th><th scope="col">Visitors</th><th scope="col">Billable</th><th scope="col">Repeats</th><th scope="col">Referral fees</th><th scope="col">Monthly checkpoint</th></tr></thead><tbody>{sorted.map(row=><tr key={row.providerId} data-traffic-provider={row.providerId}>
     <th scope="row"><div className={s.provider}><ProviderMark providerId={row.providerId} size={32}/><div><bdi>{name(row.providerId)}</bdi><small>{row.lastOutboundAt?`Last referral ${stamp(row.lastOutboundAt)}`:'No referrals in this period'}</small><button className={s.pricingAction} type="button" aria-disabled={q.isFetching||undefined} onClick={()=>{if(!q.isFetching)setEditing(row.tariff);}} aria-label={`Set referral pricing for ${name(row.providerId)}`}>Referral pricing</button></div></div></th>
     <td className={s.number}>{count(row.counts.outbound)}</td><td className={s.number}>{count(row.counts.uniqueVisitorSessions)}</td><td className={s.number}>{count(row.counts.billable)}</td><td className={s.number}>{count(row.counts.repeats)}</td><td className={s.number}><FeeTotal counts={row.counts}/></td><td><Checkpoint row={row} month={monthLabel(d.period.monthKey)} current={d.period.monthKey===d.period.currentMonthKey}/></td>
    </tr>)}</tbody></table></div>
   </section>
   <section className={s.section} aria-labelledby="daily-referrals-heading"><div className={s.sectionHeader}><div><h2 id="daily-referrals-heading">Daily referrals</h2><p>Recorded outbound and billable activity in the selected period.</p></div><div className={s.legend} aria-hidden="true"><span><i/>Outbound</span><span><i/>Billable</span></div></div>{d.totals.outbound?<DailyTrend daily={d.daily}/>:<div className={s.empty}><h2>No outbound referrals in this period</h2><p>Provider visits appear here when a traveler continues from a ticket or hotel offer.</p><a href="/travel">Open travel search →</a></div>}</section>
   <section className={s.section} aria-labelledby="outbound-records-heading"><div className={s.sectionHeader}><div><h2 id="outbound-records-heading">Outbound records</h2><p>Inspect the exact offer and referral trail behind each recorded visit.</p></div></div>{d.events.items.length?<><div className={base.tableWrap}><table aria-label="Outbound referral records"><thead><tr><th>Provider</th><th>Type</th><th>Billing</th><th>Referral fee</th><th>Sent</th><th>Evidence</th></tr></thead><tbody>{d.events.items.map(event=><tr key={event.referralId}><td><bdi>{name(event.providerId)}</bdi></td><td>{event.kind==='transport'?'Transport':'Hotel'}</td><td>{event.billable?'Billable':'Repeat within 60 minutes'}</td><td>{!event.billable?'Not billed':event.rateRial===null?'No rate at referral':fee(event.rateRial)}</td><td>{stamp(event.redirectedAt)}</td><td><Link to={'/referrals/'+event.referralId}>View referral</Link></td></tr>)}</tbody></table></div><Pager offset={d.events.offset} limit={d.events.limit} total={d.events.total} onChange={setOffset}/></>:<p className={s.note}>No outbound records match these filters.</p>}</section>
  </>}</DataState>
  {editing&&<ProviderPricing key={editing.providerId+':'+editing.revision} tariff={editing} name={name(editing.providerId)} onClose={()=>setEditing(undefined)} onRefresh={()=>{setEditing(undefined);refresh();}} onSaved={()=>{setEditing(undefined);refresh();}}/>}
 </>;
}
