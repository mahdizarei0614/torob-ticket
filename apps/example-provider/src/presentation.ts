import type { IdentityClaims } from '@torob-ticket/provider-sdk';

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const mark = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 25V14a7 7 0 0 1 14 0v5a4 4 0 0 0 8 0"/><circle cx="7" cy="26" r="3"/><path d="m17 10 4-4 4 4"/></svg>';
const arrow = '<svg class="arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17 7 7 17M7 7h10v10"/></svg>';
const plane = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="m7 27 14-5 5-15 4 1-1 14 10 6v4l-12-2-6 10-3-1 2-12-11 3z"/></svg>';

export function siteDocument(title: string, body: string, issuerOrigin: string) {
  const issuer = escapeHtml(issuerOrigin);
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/styles.css"></head><body><a class="skip-link" href="#main">رفتن به محتوای اصلی</a><header class="site-header"><div class="masthead"><a class="wordmark" href="/" aria-label="راه‌آرا، خانه"><span class="brand-symbol">${mark}</span><span>راه‌آرا<small>همراه مسیرهای شما</small></span></a><nav aria-label="راهبری اصلی"><a href="${issuer}">جست‌وجوی سفر ${arrow}</a><a href="/#destinations">مقصدهای سفر</a><a href="/#how-it-works">راهنمای ورود</a></nav><a class="quiet header-action" href="${issuer}">مقایسه در ترب‌تیکت ${arrow}</a></div></header><main id="main">${body}</main><footer><a class="footer-brand" href="/">راه‌آرا</a><p>همراه شما، از انتخاب مسیر تا ادامهٔ سفر.</p><a href="${issuer}">بازگشت به ترب‌تیکت ${arrow}</a></footer></body></html>`;
}

function travelVisual() {
  return `<aside class="travel-visual" aria-label="ایدهٔ سفر به کیش"><div class="visual-heading"><span>از شهر، تا صدای دریا</span><span class="visual-coordinate" dir="ltr">THR → KIH</span></div><svg class="journey-art" viewBox="0 0 480 240" fill="none" aria-hidden="true"><circle class="art-sun" cx="104" cy="72" r="35"/><path class="art-land" d="m0 182 86-49 56 25 79-66 63 54 51-25 145 61v58H0z"/><path class="art-water" d="M0 198q60-26 120 0t120 0 120 0 120 0v42H0z"/><path class="art-route" d="M61 143C170 8 342 28 415 153"/><circle class="route-end" cx="61" cy="143" r="5"/><circle class="route-end" cx="415" cy="153" r="5"/><path class="art-plane" d="m238 57 20-8 9-24 6 2-3 24 15 11-1 6-19-5-11 15-5-2 5-21-15 5z"/></svg><div class="inspiration-ticket"><div class="ticket-heading"><span class="mini-plane">${plane}</span><span>ایدهٔ سفر بعدی شما<small>تهران به کیش</small></span><span class="ticket-label">پرواز داخلی</span></div><div class="ticket-route"><div><strong dir="ltr">THR</strong><span>تهران</span></div><div class="route-line"><span>خلیج فارس، مقصد شما</span><i></i></div><div><strong dir="ltr">KIH</strong><span>کیش</span></div></div></div></aside>`;
}

// Authored destination content for the local provider presentation. These are
// discovery ideas, not priced inventory, confirmed bookings or referral facts.
const destinations = [
  { name: 'کیش', code: 'KIH', kind: 'ساحل و آرامش', description: 'چند روز نزدیک‌تر به دریا؛ با صبح‌های آرام و قدم‌زدن کنار ساحل.', art: 'coast' },
  { name: 'شیراز', code: 'SYZ', kind: 'باغ و گشت‌وگذار', description: 'از باغ‌های سرسبز تا کوچه‌های قدیمی؛ برای یک سفر با حوصله.', art: 'garden' },
  { name: 'مشهد', code: 'MHD', kind: 'شهر و خاطره', description: 'وقت دیدار، گشت‌وگذار در شهر و امتحان‌کردن طعم‌های تازه.', art: 'city' },
] as const;

function destinationArt(kind: typeof destinations[number]['art']) {
  const scenery = kind === 'coast'
    ? '<path class="scenery-back" d="M0 118q75-25 150 0t150 0v62H0z"/><path class="scenery-front" d="M0 149q80-20 156 0t144 0v31H0z"/><path class="scenery-line" d="M224 144q-7-41 3-70m-1 5q-28-20-46 2m47-3q19-26 41-6m-40 7q-5-33-23-37m25 34q23-6 40 15"/>'
    : kind === 'garden'
      ? '<path class="scenery-back" d="M0 151h300v29H0zM62 151V73l16-24 16 24v78m114 0V66l14-22 14 22v85"/><path class="scenery-front" d="M103 151V85h91v66h-23v-33a23 23 0 0 0-46 0v33z"/><path class="scenery-line" d="M114 85V69h68v16M148 151v29M0 160h300"/>'
      : '<path class="scenery-back" d="M35 151V86h44v65m143 0V94h42v57M0 151h300v29H0z"/><path class="scenery-front" d="M92 151V89h116v62h-22v-22a13 13 0 0 0-26 0v22h-22v-22a13 13 0 0 0-26 0v22z"/><path class="scenery-line" d="M99 88q12-42 51-43 39 1 51 43M149 45V28M45 106h22m165 8h22"/>';
  return `<svg viewBox="0 0 300 180" fill="none" aria-hidden="true"><circle class="scenery-sun" cx="68" cy="47" r="20"/>${scenery}</svg>`;
}

function destinationSection(issuerOrigin: string) {
  return `<section id="destinations" class="destinations"><div class="section-heading"><div><p class="eyebrow">چمدانتان را برای کجا ببندیم؟</p><h2>یک مقصد تازه، یک حال تازه</h2></div><a class="text-link" href="${escapeHtml(issuerOrigin)}">جست‌وجوی سفر ${arrow}</a></div><div class="destination-grid">${destinations.map(d => `<article class="destination-card"><div class="destination-art ${d.art}">${destinationArt(d.art)}<span class="airport-code" dir="ltr">${d.code}</span></div><div class="destination-copy"><span class="destination-kind">${d.kind}</span><h3>${d.name}</h3><p>${d.description}</p></div></article>`).join('')}</div></section>`;
}

export function landingContent(input: { issuerOrigin: string; providerName?: string; continueUrl?: string; banner?: string }) {
  const { issuerOrigin, continueUrl } = input;
  const action = continueUrl ? 'ادامه با ترب‌تیکت' : 'انتخاب پیشنهاد در ترب‌تیکت ↗';
  return `${input.banner ?? ''}<section class="hero"><div class="hero-copy"><p class="eyebrow">${escapeHtml(input.providerName ?? 'راه‌آرا')} · همراه مسیرهای شما</p><h1>${continueUrl ? 'سفر شما،<br><span>یک قدم نزدیک‌تر.</span>' : 'از اینجا،<br><span>راهیِ سفر شوید.</span>'}</h1><p class="hero-description">مسیرتان را در ترب‌تیکت پیدا کنید و با همان حساب، در راه‌آرا ادامه دهید. مشخصات مسافر هم همراه شما می‌آید.</p><a class="button hero-action" href="${escapeHtml(continueUrl ?? issuerOrigin)}">${action}${continueUrl ? arrow : ''}</a><p class="consent-note"><span aria-hidden="true">✓</span> دریافت مشخصات مسافر، فقط با اجازهٔ شما</p></div>${travelVisual()}</section><section id="how-it-works" class="steps" aria-label="مراحل ادامهٔ سفر"><div><span class="step-number">۰۱</span><h2>مسیر را انتخاب کنید</h2><p>پیشنهادهای سفر را در ترب‌تیکت مقایسه کنید.</p></div><div><span class="step-number">۰۲</span><h2>با همان حساب وارد شوید</h2><p>با «ادامه با ترب‌تیکت» وارد راه‌آرا شوید.</p></div><div><span class="step-number">۰۳</span><h2>مشخصات آمادهٔ ادامه است</h2><p>مشخصات ثبت‌شده را در حساب خود ببینید.</p></div></section>${destinationSection(issuerOrigin)}<section class="questions"><div><p class="eyebrow">پیش از ادامه</p><h2>همان حساب،<br> در ادامهٔ مسیر</h2></div><div><details><summary>چه اطلاعاتی به راه‌آرا منتقل می‌شود؟</summary><p>شمارهٔ همراه و مشخصات موردنیاز مسافر، فقط پس از تأیید شما در ترب‌تیکت دریافت می‌شود. پیش از ادامه می‌توانید اطلاعات و درخواست دسترسی را ببینید.</p></details><details><summary>اگر قبلاً وارد راه‌آرا شده باشم چه می‌شود؟</summary><p>با همان حساب ترب‌تیکت ادامه دهید؛ حساب قبلی شما در راه‌آرا دوباره استفاده می‌شود و نیاز نیست مشخصاتتان را از ابتدا وارد کنید.</p></details></div></section>`;
}

function detail(label: string, value: string, ltr = false) {
  return `<div><dt>${label}</dt><dd${ltr ? ' dir="ltr"' : ''}>${escapeHtml(value)}</dd></div>`;
}

export function accountContent(input: { claims: IdentityClaims; account: { id: string; createdAt: string }; accountStatus: 'created' | 'existing'; clientId: string; logoutCsrf: string; issuerOrigin: string; banner?: string; continueUrl?: string }) {
  const { claims, account, accountStatus, clientId } = input;
  const profile = claims.traveler_profile;
  const fullName = profile ? `${profile.givenName} ${profile.familyName}` : 'مسافر';
  const payload = { provider_account: { id: account.id, status: accountStatus, created_at: account.createdAt }, identity: claims };
  const profileDetails = profile ? [
    detail('نام و نام خانوادگی', fullName),
    detail('تاریخ تولد · میلادی', profile.birthDate, true),
    detail('ملیت', new Intl.DisplayNames(['fa'], { type: 'region' }).of(profile.nationality) ?? profile.nationality),
    detail('جنسیت', { female: 'زن', male: 'مرد', unspecified: 'تعیین نشده' }[profile.gender]),
    profile.nationalId ? detail('کد ملی', profile.nationalId, true) : '',
    profile.passport ? [
      detail('شمارهٔ گذرنامه', profile.passport.number, true),
      detail('کشور صادرکننده', profile.passport.issuingCountry, true),
      detail('اعتبار گذرنامه · میلادی', profile.passport.expiresOn, true),
    ].join('') : '',
    profile.latinGivenName ? detail('نام لاتین', profile.latinGivenName, true) : '',
    profile.latinFamilyName ? detail('نام خانوادگی لاتین', profile.latinFamilyName, true) : '',
    profile.email ? detail('ایمیل', profile.email, true) : '',
  ].join('') : '';
  return `${input.banner ?? ''}<section class="account-welcome"><div><p class="eyebrow">حساب راه‌آرا · ورود با ترب‌تیکت</p><h1>خوش آمدید، ${escapeHtml(profile?.givenName ?? 'مسافر')}</h1><p>مشخصات مسافر با اجازهٔ شما دریافت شد.</p></div><form action="/providers/${escapeHtml(clientId)}/logout" method="post"><input type="hidden" name="csrf" value="${escapeHtml(input.logoutCsrf)}"><button class="quiet">خروج از حساب</button></form></section><div class="account-grid"><section class="panel traveler-panel"><div class="panel-heading"><h2>مشخصات مسافر</h2><span class="status-tag"><span aria-hidden="true">✓</span> دریافت‌شده از ترب‌تیکت</span></div><dl class="profile-details">${profileDetails}${detail('شمارهٔ همراه', claims.phone_number, true)}</dl></section><aside class="panel account-summary"><span class="account-avatar" aria-hidden="true">${escapeHtml(profile?.givenName.slice(0, 1) ?? 'ر')}</span><h2>${escapeHtml(fullName)}</h2><p class="status-text">${accountStatus === 'created' ? 'حساب شما ایجاد شد' : 'وارد حساب قبلی شدید'}</p><dl><div><dt>شناسهٔ حساب راه‌آرا</dt><dd dir="ltr">${escapeHtml(account.id)}</dd></div></dl><a class="button" href="${escapeHtml(input.issuerOrigin)}">ادامهٔ جست‌وجوی سفر ${arrow}</a></aside></div><section class="panel response-panel"><div class="panel-heading"><div><p class="eyebrow">پاسخ ورود</p><h2>اطلاعات دریافت‌شده از ترب‌تیکت</h2></div><span class="code-label" dir="ltr">JSON</span></div><pre id="sso-response" dir="ltr" tabindex="0" aria-label="SSO response JSON">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>${input.continueUrl ? `<a class="text-link" href="${escapeHtml(input.continueUrl)}">ادامه با ترب‌تیکت</a>` : ''}</section>${destinationSection(input.issuerOrigin)}`;
}
