import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { apiClient, directLoginClient } from '@torob-ticket/client';
import { AuthorizeSchema, type DirectFlowSchema, type DirectIdentitySchema, type ReferencePageSchema } from '@torob-ticket/contracts';
import type { z } from 'zod';
import { BrandLogo, ProviderMark, ThemeProvider, Price } from '@torob-ticket/ui';
import s from './direct-login.module.css';
type Identity = z.infer<typeof DirectIdentitySchema>;
function Frame({ children, providerId }: { children: ReactNode; providerId?: string }) { return <ThemeProvider language="fa"><main className={s.page} lang="fa" dir="rtl"><section className={s.card}><header className={s.brand}><a href="/" aria-label="ترب‌تیکت"><BrandLogo language="fa" decorative /></a>{providerId && <ProviderMark providerId={providerId} size={40} />}</header>{children}</section></main></ThemeProvider>; }
function message(error: unknown) { return error instanceof Error ? error.message : 'درخواست انجام نشد'; }
export function PhoneVerification({ providerId, onVerified }: { providerId?: string; onVerified: (identity: Identity) => void }) {
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [challenge, setChallenge] = useState<{ id: string; expiresAt: string }>(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const live = useRef(true), lock = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  async function submit() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (challenge) { const result = await directLoginClient.verify(challenge.id, code.replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))), providerId); if (live.current && result.identity) onVerified(result.identity); }
      else { const result = await directLoginClient.code(phone, providerId); if (live.current) setChallenge(result); }
    } catch (error) { if (live.current) setError(message(error)); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  }
  return <form className={s.form} onSubmit={event => { event.preventDefault(); void submit(); }}>
    {challenge ? <><p>کد تأیید شماره <bdi dir="ltr">{phone}</bdi> را وارد کنید</p><label>کد تأیید<input autoFocus autoComplete="one-time-code" inputMode="numeric" dir="ltr" value={code} maxLength={6} required onChange={e => setCode(e.target.value)} /></label></> : <label>شماره همراه<input autoComplete="tel" type="tel" inputMode="tel" placeholder="۰۹۱۲۱۲۳۴۵۶۷" dir="ltr" value={phone} required onChange={e => setPhone(e.target.value)} /></label>}
    {error && <div role="alert" className={s.error}>{error}</div>}
    <button className={s.button} disabled={busy}>{busy ? 'در حال بررسی…' : challenge ? 'تأیید و ورود' : 'دریافت کد تأیید'}</button>
    {challenge && <button className={s.inline} type="button" disabled={busy} onClick={() => { setChallenge(undefined); setCode(''); setError(''); }}>تغییر شماره یا دریافت دوباره کد</button>}
  </form>;
}
export function DirectLoginPage() {
  const { id } = useParams(), location = useLocation(), navigate = useNavigate();
  const [flow, setFlow] = useState<z.infer<typeof DirectFlowSchema>>(), [identity, setIdentity] = useState<Identity | null>(), [error, setError] = useState(''), [busy, setBusy] = useState(false), [generation, reload] = useState(0);
  const begin = location.pathname === '/direct-login/begin', alive = useRef(true), lock = useRef(false);
  useEffect(() => { alive.current = true; const controller = new AbortController();
    void (async () => {
      await apiClient.session();
      if (controller.signal.aborted) return;
      if (begin) { const input = AuthorizeSchema.parse(Object.fromEntries(new URLSearchParams(location.search))); const result = await directLoginClient.begin(input); if (!controller.signal.aborted) void navigate(result.redirect, { replace: true }); }
      else if (id) { const result = await directLoginClient.flow(id, controller.signal); if (!controller.signal.aborted) { setFlow(result); setIdentity(result.identity); } }
      else { const result = await directLoginClient.account(controller.signal); if (!controller.signal.aborted) setIdentity(result.identity); }
    })().catch(e => { if (!controller.signal.aborted) setError(message(e)); });
    return () => { alive.current = false; controller.abort(); };
  }, [id, begin, location.search, navigate, generation]);
  async function action(approved: boolean) {
    if (!id || lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const result = await directLoginClient.consent(id, approved); if (alive.current) window.location.assign(result.redirect); }
    catch (e) { if (alive.current) setError(message(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function logout() { setBusy(true); try { await directLoginClient.logout(); if (alive.current) { setIdentity(null); reload(n => n + 1); } } catch (e) { if (alive.current) setError(message(e)); } finally { if (alive.current) setBusy(false); } }
  return <Frame providerId={flow?.providerId}><h1>{flow ? `ادامه در ${flow.providerName}` : 'ورود به ترب‌تیکت'}</h1>{error && <div className={s.error} role="alert">{error}</div>}
    {identity === undefined ? <p role="status">در حال آماده‌سازی ورود…</p> : !identity ? <><p>با شماره همراه خود وارد شوید</p><PhoneVerification onVerified={value => { setIdentity(value); reload(n => n + 1); }} /></> : <>
      <div className={s.details}>شماره همراه شما <bdi dir="ltr">{identity.phone}</bdi></div>
      {flow ? flow.status === 'pending' ? <><p>با ادامه، شماره همراه تأییدشده شما در اختیار {flow.providerName} قرار می‌گیرد تا وارد حساب خود شوید یا حساب بسازید.</p>{flow.existingProof && <p>حساب قبلی شما در این فروشنده پیدا شد</p>}<div className={s.actions}><button className={s.button} disabled={busy} onClick={() => void action(true)}>اجازه و ادامه</button><button className={s.quiet} disabled={busy} onClick={() => void action(false)}>انصراف</button></div></> : <><p>این درخواست ورود پایان یافته است. برای ورود دوباره از صفحه فروشنده ادامه دهید.</p><a href={`/api/v1/direct-login/start/${flow.referralId}`} className={s.quiet}>ادامه از همین پیشنهاد</a></> : <a href="/" className={s.button}>جست‌وجوی سفر</a>}
      <button className={s.inline} disabled={busy} onClick={() => void logout()}>ورود با شماره دیگر</button>
    </>}{flow && !identity && <button className={s.quiet} disabled={busy} onClick={() => void action(false)}>انصراف</button>}
  </Frame>;
}
export function ProviderChoicePage() {
  const { id = '' } = useParams(), [choice, setChoice] = useState<Awaited<ReturnType<typeof directLoginClient.choices>>>(), [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); void apiClient.session().then(() => directLoginClient.choices(id, controller.signal)).then(setChoice).catch(e => { if (!controller.signal.aborted) setError(message(e)); }); return () => controller.abort(); }, [id]);
  return <Frame providerId={choice?.providerId}><h1>{choice ? `ادامه در ${choice.providerName}` : 'انتخاب روش ادامه'}</h1><p>روش ورود به سایت فروشنده را انتخاب کنید</p>{error && <div className={s.error} role="alert">{error}</div>}{choice && <div className={s.actions}>{choice.directLogin && <a className={s.button} href={choice.callbackUrl!}>ادامه با ترب‌تیکت</a>}<a className={s.quiet} href={`/api/v1/referrals/${encodeURIComponent(id)}/outbound?visit=1`}>رفتن به سایت فروشنده</a><a className={s.inline} href="/">بازگشت به مقایسه</a></div>}</Frame>;
}
function OfferSummary({receipt}:{receipt:NonNullable<z.infer<typeof ReferencePageSchema>['receipt']>}) {
  const payload=receipt.payload;
  if(payload.kind==='hotel')return <><p>ورود {payload.quote.query.checkIn} · خروج {payload.quote.query.checkOut}</p><Price total={payload.quote.total} scope={{kind:'stay',rooms:payload.quote.query.rooms,nights:Math.round((Date.parse(payload.quote.query.checkOut)-Date.parse(payload.quote.query.checkIn))/86400000)}}/><a className={s.inline} href={receipt.handoffPath}>جزئیات کامل پیشنهاد</a></>;
  const first=payload.itinerary.outbound.segments[0]!;
  return <><p>{new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short',timeZone:first.departureTimeZone}).format(new Date(first.departureAt))}</p><p>{payload.itinerary.return?'رفت و برگشت':'یک‌طرفه'}</p><Price total={payload.quote.total} scope={{kind:'party',travelers:payload.quote.party.adults+payload.quote.party.children+payload.quote.party.infants}}/><a className={s.inline} href={receipt.handoffPath}>جزئیات کامل پیشنهاد</a></>;
}
export function ReferenceProviderPage() {
  const { providerId = '' } = useParams(), location = useLocation(), [data, setData] = useState<z.infer<typeof ReferencePageSchema>>(), [error, setError] = useState(''), [generation, reload] = useState(0);
  const referral = new URLSearchParams(location.search).get('referral') ?? undefined;
  useEffect(() => { const controller = new AbortController(); void apiClient.session().then(() => directLoginClient.reference(providerId, referral, controller.signal)).then(setData).catch(e => { if (!controller.signal.aborted) setError(message(e)); }); return () => controller.abort(); }, [providerId, referral, generation]);
  return <Frame providerId={providerId}><h1>{data?.providerName ?? 'فروشنده سفر'}</h1>{error && <div className={s.error} role="alert">{error}</div>}{data ? <>
    {location.search.includes('login=interrupted') && <p role="status">ورود کامل نشد. دوباره از همین پیشنهاد ادامه دهید.</p>}
    {data.offer && <div className={s.details}><h2>پیشنهاد انتخاب‌شده شما</h2><p>{data.offer}</p>{data.receipt && <OfferSummary receipt={data.receipt}/>}</div>}
    {data.account ? <><p>به حساب خود خوش آمدید</p><div className={s.details}><bdi dir="ltr">{data.account.phone}</bdi></div><button className={s.quiet} onClick={() => { void directLoginClient.logout(providerId).then(() => reload(n => n + 1)).catch(e => setError(message(e))); }}>خروج از حساب فروشنده</button></> : <><p>{location.search.includes('link=required') ? 'برای اتصال، ابتدا وارد حساب قبلی خود در این فروشنده شوید' : 'برای ادامه وارد حساب خود شوید یا حساب بسازید'}</p>{data.continueUrl && <a className={s.button} href={data.continueUrl}>ادامه با ترب‌تیکت</a>}<PhoneVerification key={providerId} providerId={providerId} onVerified={() => reload(n => n + 1)} /></>}
    {data.account && data.continueUrl && !['new','existing','repeat'].includes(data.status??'') && <a className={s.button} href={data.continueUrl}>ادامه با ترب‌تیکت</a>}
    <a href="/" className={s.inline}>بازگشت به جست‌وجوی سفر</a>
  </> : !error && <p role="status">در حال بارگیری صفحه فروشنده…</p>}</Frame>;
}
