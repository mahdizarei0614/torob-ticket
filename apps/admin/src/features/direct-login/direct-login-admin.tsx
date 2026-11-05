import direct from './direct-login-admin.module.css';
import { useState } from 'react';
import { directLoginClient } from '@torob-ticket/client';
import { displayProviderName } from '@torob-ticket/ui';
import { useAdmin, useAdminData } from '../../admin-state';
import { DataState } from '../../components';
import type { PartnerInput } from '@torob-ticket/contracts';
import s from '../../operations.module.css';
function toman(value:number|string){const amount=BigInt(value);return `${(amount/10n).toLocaleString('en')}${amount%10n?`.${amount%10n}`:''}`;}
export function DirectLoginAdmin() {
  const { catalog, run, busy, refresh } = useAdmin();
  const query = useAdminData(['direct-login'], signal => directLoginClient.admin(signal));
  const [editing, setEditing] = useState<PartnerInput>(), [secret, setSecret] = useState('');
  const data = query.data;
  function edit(providerId: string) {
    const old = data?.partners.find(p => p.providerId === providerId);
    setSecret('');
    setEditing(old ?? { providerId, name: displayProviderName(catalog?.providerCapabilities.find(p => p.providerId === providerId)), callbackUrl: `${data?.webOrigin ?? window.location.origin}/api/v1/reference-provider/${providerId}/callback`, loginStartUrl: `${data?.webOrigin ?? window.location.origin}/api/v1/reference-provider/${providerId}/start`, enabled: true, acquisitionRateRial: null, kind: 'reference' });
  }
  return <section><header><h1>Direct Login</h1><p className={s.muted}>Provider connections, verification delivery and customer acquisition evidence.</p></header>
    <DataState loading={query.isLoading} error={query.error}>{null}</DataState>
    {data && <>
      <div className={s.metrics}>{[['New accounts', data.totals.newAccounts], ['Existing accounts', data.totals.existingAccounts], ['Awaiting evidence', data.totals.pending], ['Recorded fees · toman', toman(data.totals.amountRial)], ['Unpriced acquisitions', data.totals.unpriced]].map(([label, value]) => <div className={s.metric} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <section className={s.panel}><h2>Provider connections</h2><div className={s.tableWrap}><table><thead><tr><th>Provider</th><th>Direct Login</th><th>Acquisition rate</th><th>Connection</th></tr></thead><tbody>{catalog?.providerCapabilities.map(provider => { const partner = data.partners.find(p => p.providerId === provider.providerId); return <tr key={provider.providerId}><td>{displayProviderName(provider)}</td><td>{partner?.enabled ? 'Enabled' : 'Disabled'}</td><td>{partner?.acquisitionRateRial == null ? 'Unpriced' : `${toman(partner.acquisitionRateRial)} toman`}</td><td><button onClick={() => edit(provider.providerId)} disabled={busy}>{partner ? 'Edit connection' : 'Connect provider'}</button><button disabled={busy} onClick={()=>void run(()=>directLoginClient.installExample(provider.providerId,displayProviderName(provider)))}>Connect separate site</button>{partner?.exampleSiteUrl&&<a className={s.inlineLink} href={partner.exampleSiteUrl} target="_blank" rel="noopener noreferrer">Open provider website ↗</a>}{partner?.kind === 'reference' && <a className={s.inlineLink} href={`${data.webOrigin ?? ''}/reference-provider/${provider.providerId}`} target="_blank" rel="noopener noreferrer">Open provider ↗</a>}</td></tr>; })}</tbody></table></div></section>
      {editing && <section className={s.panel}><h2>{editing.name}</h2><form className={s.form} onSubmit={event => { event.preventDefault(); const { providerId, name, callbackUrl, loginStartUrl, enabled, acquisitionRateRial, kind } = editing; void run(() => directLoginClient.partner({ providerId, name, callbackUrl, loginStartUrl, enabled, acquisitionRateRial, kind }), result => { setSecret(result.clientSecret); refresh(); }); }}>
        <label className={s.field}>Provider name<input required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
        <label className={s.field}>Integration<select value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value as PartnerInput['kind'] })}><option value="reference">Reference provider</option><option value="external">External provider</option></select></label>
        <label className={s.field}>Callback URL<input required type="url" value={editing.callbackUrl} onChange={e => setEditing({ ...editing, callbackUrl: e.target.value })} /></label>
        <label className={s.field}>Login initiation URL<input required type="url" value={editing.loginStartUrl} onChange={e => setEditing({ ...editing, loginStartUrl: e.target.value })} /></label>
        <label className={s.field}>Acquisition rate · IRR<input type="number" min="0" step="1" value={editing.acquisitionRateRial ?? ''} onChange={e => setEditing({ ...editing, acquisitionRateRial: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        <label><input type="checkbox" checked={editing.enabled} onChange={e => setEditing({ ...editing, enabled: e.target.checked })} /> Enable Direct Login</label>
        <p className={s.muted}>Saving rotates the client secret. Future accepted referrals use the saved rate.</p><div className={s.actions}><button disabled={busy}>Save connection</button><button type="button" onClick={() => { setEditing(undefined); setSecret(''); }}>Close</button></div>
      </form>{secret && <div className={s.preview}><strong>Client secret · copy now</strong><p><code>{secret}</code></p><p className={s.muted}>Keep this credential on the provider backend.</p></div>}</section>}
      <section className={s.panel}><header><h2>Verification messages</h2><button onClick={refresh}>Refresh messages</button></header>{data.messages.length ? <div className={s.tableWrap}><table><thead><tr><th>Destination</th><th>Purpose</th><th>Code</th><th>Expires</th></tr></thead><tbody>{data.messages.map(m => <tr key={m.id}><td>{m.destination}</td><td>{m.purpose}</td><td><code>{m.code}</code></td><td>{new Date(m.expiresAt).toLocaleTimeString('en')}</td></tr>)}</tbody></table></div> : <p className={s.muted}>No active verification messages.</p>}</section>
      <section className={`${s.panel} ${direct.evidence}`}><h2>Acquisition evidence</h2>{data.acquisitions.length ? <div className={s.tableWrap}><table><thead><tr><th>Provider / referral</th><th>Status</th><th>Evidence</th><th>Fee</th></tr></thead><tbody>{data.acquisitions.map(a => <tr key={a.id}><td>{data.partners.find(p => p.providerId === a.providerId)?.name}<small><a href={`/admin/referrals/${a.referralId}`}>{a.referralId}</a></small></td><td>{a.status}<small>{a.reason}</small></td><td>{a.evidence}<small>{a.accountId}</small></td><td>{a.status !== 'new' ? '—' : a.rateRial === null ? 'Unpriced' : `${toman(a.rateRial)} toman`}<small>Rate revision {a.tariffRevision}</small></td></tr>)}</tbody></table></div> : <p className={s.muted}>Account activity appears after a traveler authorizes a connected provider.</p>}</section>
    </>}
  </section>;
}
