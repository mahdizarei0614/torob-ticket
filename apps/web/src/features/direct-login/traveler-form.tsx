import { travelerProfileForTrip, localDateAt } from '@torob-ticket/domain';
import { useEffect, useRef, useState } from 'react';
import { directLoginClient } from '@torob-ticket/client';
import { TravelerProfileSchema, type TravelerProfile, type TravelContext } from '@torob-ticket/contracts';
import s from './direct-login.module.css';

export function TravelerForm({ profile, context, onSaved }: { profile?: TravelerProfile; context: TravelContext; onSaved: (profile: TravelerProfile) => void }) {
  const [draft, setDraft] = useState({ givenName: profile?.givenName ?? '', familyName: profile?.familyName ?? '', birthDate: profile?.birthDate ?? '', gender: profile?.gender ?? 'unspecified', nationality: profile?.nationality ?? 'IR', email: profile?.email ?? '', nationalId: profile?.nationalId ?? '', latinGivenName: profile?.latinGivenName ?? '', latinFamilyName: profile?.latinFamilyName ?? '', passportNumber: profile?.passport?.number ?? '', issuingCountry: profile?.passport?.issuingCountry ?? profile?.nationality ?? 'IR', expiresOn: profile?.passport?.expiresOn ?? '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const passport = context.international || draft.nationality.toUpperCase() !== 'IR';
  const field = (key: keyof typeof draft) => ({ value: draft[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft(d => ({ ...d, [key]: e.target.value })) });
  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const value = TravelerProfileSchema.parse({ givenName: draft.givenName, familyName: draft.familyName, birthDate: draft.birthDate, gender: draft.gender, nationality: draft.nationality, ...(draft.email.trim() ? { email: draft.email } : {}), ...(passport ? { passport: { number: draft.passportNumber, issuingCountry: draft.issuingCountry, expiresOn: draft.expiresOn } } : { nationalId: draft.nationalId }), ...(context.international ? { latinGivenName: draft.latinGivenName, latinFamilyName: draft.latinFamilyName } : {}) });
      if (value.gender === 'unspecified') throw new Error('جنسیت مسافر را انتخاب کنید');
      travelerProfileForTrip(value, context, localDateAt(new Date().toISOString(), 'Asia/Tehran'));
      const result = await directLoginClient.saveProfile(value);
      if (alive.current && result.identity?.profile) onSaved(result.identity.profile);
    } catch (e) { if (alive.current) setError(e instanceof Error && !('issues' in e) ? e.message : 'اطلاعات مسافر را بررسی کنید؛ تاریخ‌ها باید میلادی و کد کشور دو حرف لاتین باشند'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <form className={s.form} onSubmit={e => { e.preventDefault(); void save(); }}>
    <h2>مشخصات مسافر اصلی</h2><p>{context.international ? 'برای سفر خارجی، نام لاتین و اطلاعات گذرنامه را مطابق مدرک وارد کنید.' : 'مشخصات را مطابق مدرک هویتی وارد کنید.'} اطلاعات سایر مسافران در سایت فروشنده تکمیل می‌شود.</p>
    <div className={s.fields}><label>نام<input autoComplete="given-name" required maxLength={100} {...field('givenName')} /></label><label>نام خانوادگی<input autoComplete="family-name" required maxLength={100} {...field('familyName')} /></label></div>
    <div className={s.fields}><label>تاریخ تولد (میلادی)<input type="date" autoComplete="bday" dir="ltr" required {...field('birthDate')} /></label><label>جنسیت<select required {...field('gender')}><option value="unspecified" disabled>انتخاب کنید</option><option value="female">زن</option><option value="male">مرد</option></select></label></div>
    <label>کد کشور تابعیت<input dir="ltr" autoCapitalize="characters" maxLength={2} pattern="[A-Za-z]{2}" required aria-describedby="country-help" {...field('nationality')} /><small id="country-help">دو حرف لاتین؛ برای ایران IR</small></label>
    {context.international && <div className={s.fields}><label>نام لاتین<input dir="ltr" required maxLength={100} autoComplete="off" {...field('latinGivenName')} /></label><label>نام خانوادگی لاتین<input dir="ltr" required maxLength={100} autoComplete="off" {...field('latinFamilyName')} /></label></div>}
    {passport ? <><label>شماره گذرنامه<input dir="ltr" required maxLength={20} {...field('passportNumber')} /></label><div className={s.fields}><label>کد کشور صادرکننده<input dir="ltr" required maxLength={2} pattern="[A-Za-z]{2}" {...field('issuingCountry')} /></label><label>انقضای گذرنامه (میلادی)<input type="date" dir="ltr" min={context.lastTravelDate} required {...field('expiresOn')} /></label></div></> : <label>کد ملی<input dir="ltr" inputMode="numeric" autoComplete="off" maxLength={10} minLength={10} required {...field('nationalId')} /></label>}
    <label>ایمیل (اختیاری)<input type="email" dir="ltr" autoComplete="email" maxLength={254} {...field('email')} /></label>
    {error && <div role="alert" className={s.error}>{error}</div>}<button className={s.button} disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیره مشخصات مسافر'}</button>
  </form>;
}
