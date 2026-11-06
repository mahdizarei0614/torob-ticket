import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { constantEqual, createProviderSdk, randomToken, sha256 } from '@torob-ticket/provider-sdk';
import { ProviderStore, type Registration } from './store';

export interface SiteConfiguration { origin: string; issuerOrigin: string; issuerInternalOrigin: string; storeFile: string; publicDirectory: string; assetsDirectory: string; transport?: typeof fetch }
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const clientPattern = /^[0-9a-f-]{36}$/;
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function cookie(request: IncomingMessage, name: string) {
  const values = (request.headers.cookie ?? '').split(';').map(c => c.trim()).filter(c => c.startsWith(`${name}=`));
  return values.length === 1 && tokenPattern.test(values[0]!.slice(name.length + 1)) ? values[0]!.slice(name.length + 1) : undefined;
}
function setCookie(response: ServerResponse, config: SiteConfiguration, name: string, value: string, seconds: number) {
  const previous = response.getHeader('Set-Cookie');
  response.setHeader('Set-Cookie', [...(Array.isArray(previous) ? previous.map(String) : previous ? [String(previous)] : []), `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${config.origin.startsWith('https:') ? '; Secure' : ''}`]);
}
function redirect(response: ServerResponse, location: string) { response.writeHead(303, { Location: location }); response.end(); }
function document(title: string, body: string, issuerOrigin: string) {
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/styles.css"></head><body><header class="masthead"><a class="wordmark" href="/">راه‌آرا<span>همراه مسیرهای شما</span></a><a href="${escapeHtml(issuerOrigin)}">جست‌وجو در ترب‌تیکت ↗</a></header><main>${body}</main><footer>اطلاعات سفر و حساب کاربری شما</footer></body></html>`;
}
function page(response: ServerResponse, config: SiteConfiguration, title: string, body: string, status = 200) { response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }); response.end(document(title, body, config.issuerOrigin)); }
async function jsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('JSON required');
  const chunks: Buffer[] = []; let length = 0;
  for await (const chunk of request) { const value = Buffer.from(chunk); length += value.length; if (length > 4096) throw new Error('Request too large'); chunks.push(value); }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString());
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid JSON');
  return value as Record<string, unknown>;
}
export function createProviderSite(config: SiteConfiguration) {
  const origin = new URL(config.origin), issuer = new URL(config.issuerOrigin);
  if (origin.hostname === issuer.hostname) throw new Error('Provider and issuer must have different hostnames');
  for (const url of [origin, issuer]) if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('HTTPS or loopback origins required');
  const store = new ProviderStore(config.storeFile), transport = config.transport ?? fetch;
  // Network destinations are configured by the operator, never by callback/query input.
  const backchannel: typeof fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== issuer.origin || !url.pathname.startsWith('/api/v1/direct-login/')) throw new Error('Unrecognized issuer endpoint');
    const target = new URL(url.pathname + url.search, config.issuerInternalOrigin);
    return transport(target, { ...init, signal: AbortSignal.timeout(8000), redirect: 'error' });
  };
  const sdk = (registration: Registration) => createProviderSdk({ issuer: registration.issuer, clientId: registration.clientId, clientSecret: registration.clientSecret, callbackUrl: registration.callbackUrl, scope: 'openid phone traveler', transport: backchannel });
  async function active(registration: Registration) {
    const result = await backchannel(`${issuer.origin}/api/v1/direct-login/client-status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: registration.clientId, client_secret: registration.clientSecret }) });
    if (!result.ok) throw new Error('Connection unavailable');
  }
  async function deliver(id: string) {
    const entry = await store.update(s => { const event = s.outbox.find(e => e.id === id && !e.delivered); return event && { event, registration: s.registrations.find(r => r.clientId === event.clientId) }; });
    if (!entry?.registration) return;
    try {
      await sdk(entry.registration).reportAccount(entry.event.referralId, entry.event.subject, entry.event.accountId);
      await store.update(s => { const event = s.outbox.find(e => e.id === id); if (event) event.delivered = true; });
    } catch { /* Keep the durable event for a later bounded retry. */ }
  }
  let delivering = false;
  async function retryReports() {
    if (delivering) return; delivering = true;
    try { const ids = await store.update(s => s.outbox.filter(e => !e.delivered).slice(0, 5).map(e => e.id)); for (const id of ids) await deliver(id); }
    finally { delivering = false; }
  }
  const retry = setInterval(() => { void retryReports().catch(() => undefined); }, 30000); retry.unref();
  const server = createServer((request, response) => { void handle(request, response).catch(() => { if (!response.headersSent) page(response, config, 'ورود کامل نشد', '<section class="panel"><h1>ورود کامل نشد</h1><p>برای ادامه از پیشنهاد انتخاب‌شده در ترب‌تیکت دوباره وارد شوید.</p></section>', 400); else response.end(); }); });
  server.on('close', () => clearInterval(retry));
  async function handle(request: IncomingMessage, response: ServerResponse) {
    response.setHeader('Cache-Control', 'no-store, private'); response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    const url = new URL(request.url ?? '/', config.origin);
    if (url.pathname === '/health/ready' && request.method === 'GET') { await store.update(() => undefined); response.end('ready'); return; }
    if (url.pathname === '/internal/registrations' && request.method === 'POST') {
      const body = await jsonBody(request);
      if (Object.keys(body).sort().join(',') !== 'clientId,code' || typeof body.clientId !== 'string' || !clientPattern.test(body.clientId) || typeof body.code !== 'string' || !tokenPattern.test(body.code)) throw new Error('Invalid installation');
      const result = await backchannel(`${issuer.origin}/api/v1/direct-login/example-registration`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: body.clientId, code: body.code }) });
      if (!result.ok) throw new Error('Installation rejected');
      const registration = await result.json() as Registration;
      if (!Number.isSafeInteger(registration.revision) || registration.revision < 1 || registration.clientId !== body.clientId || registration.issuer !== `${issuer.origin}/api/v1/direct-login/issuer/${body.clientId}` || registration.providerOrigin !== origin.origin || registration.callbackUrl !== `${origin.origin}/callback` || typeof registration.clientSecret !== 'string' || !tokenPattern.test(registration.clientSecret) || typeof registration.providerName !== 'string' || typeof registration.providerId !== 'string') throw new Error('Invalid registration');
      await store.update(s => {
        const previous = s.registrations.find(r => r.clientId === registration.clientId);
        if (previous && previous.revision >= registration.revision) throw new Error('Stale installation');
        if (s.registrations.length >= 100 && !s.registrations.some(r => r.clientId === registration.clientId)) throw new Error('Registration capacity reached');
        s.registrations = [...s.registrations.filter(r => r.clientId !== registration.clientId), registration];
        s.sessions = s.sessions.filter(r => r.clientId !== registration.clientId); s.transactions = s.transactions.filter(r => r.clientId !== registration.clientId);
      });
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ installed: true, clientId: registration.clientId })); return;
    }
    if (request.headers.host !== origin.host) throw new Error('Unrecognized host');
    if (request.method === 'GET' && ['/styles.css', '/tokens.css', '/font.woff2'].includes(url.pathname)) {
      const file = url.pathname === '/styles.css' ? resolve(config.publicDirectory, 'styles.css') : url.pathname === '/tokens.css' ? resolve(config.assetsDirectory, '../libs/ui/src/styles/tokens.css') : resolve(config.assetsDirectory, 'fonts/Vazirmatn-wght.woff2');
      response.writeHead(200, { 'content-type': url.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'font/woff2' }); response.end(await readFile(file)); return;
    }
    if (url.pathname === '/' && request.method === 'GET') { page(response, config, 'راه‌آرا | سفر از همین‌جا شروع می‌شود', '<section class="hero"><span class="eyebrow">راه‌آرا · خدمات سفر</span><h1>قدم بعدی،<br>سفر شماست.</h1><p>پیشنهاد سفر خود را در ترب‌تیکت انتخاب کنید و با مشخصات مسافر خود ادامه دهید.</p><a class="button" href="'+escapeHtml(config.issuerOrigin)+'">پیدا کردن مسیر سفر ↗</a></section><section class="panel"><h2>یک حساب برای ادامه مسیر</h2><p>با «ادامه با ترب‌تیکت»، پس از تأیید شما اطلاعات مسافر در حساب راه‌آرا قرار می‌گیرد.</p></section>'); return; }
    if (url.pathname === '/callback' && request.method === 'GET') {
      const binding = cookie(request, 'ep_flow');
      if (!binding || url.searchParams.getAll('state').length !== 1 || (url.searchParams.getAll('code').length !== 1 && url.searchParams.getAll('error').length !== 1)) throw new Error('Invalid callback');
      const callbackHash = sha256(url.href);
      const found = await store.update(s => {
        const flow = s.transactions.find(t => t.hash === sha256(binding));
        if (!flow || !constantEqual(flow.transaction.state, url.searchParams.get('state') ?? '')) throw new Error('Unrecognized transaction');
        const registration = s.registrations.find(r => r.clientId === flow.clientId);
        if (!registration) throw new Error('Connection missing');
        if (flow.status === 'complete' && flow.callbackHash === callbackHash && flow.sessionToken && s.sessions.some(session => session.hash === sha256(flow.sessionToken!) && session.clientId === flow.clientId)) return { registration, flow, cached: true };
        if (flow.status !== 'pending') return { registration, flow, interrupted: true };
        flow.status = 'redeeming'; flow.callbackHash = callbackHash;
        return { registration, flow };
      });
      const destination = `/providers/${found.registration.clientId}`;
      if (found.cached) { await active(found.registration); setCookie(response, config, `ep_session_${found.registration.clientId}`, found.flow.sessionToken!, 86400); redirect(response, destination); return; }
      if (found.interrupted || url.searchParams.has('error')) {
        await store.update(s => { const f = s.transactions.find(t => t.hash === found.flow.hash); if (f && f.status !== 'complete') f.status = 'interrupted'; });
        redirect(response, `${destination}?${url.searchParams.has('error') ? 'cancelled=1' : 'interrupted=1'}&ref=${found.flow.transaction.referral}`); return;
      }
      try {
        const claims = await sdk(found.registration).finish(url, found.flow.transaction), sessionToken = randomToken();
        const eventId = await store.update(s => {
          const current = s.registrations.find(r => r.clientId === found.registration.clientId), flow = s.transactions.find(t => t.hash === found.flow.hash);
          if (!current || current.clientSecret !== found.registration.clientSecret || !flow || flow.status !== 'redeeming') throw new Error('Connection changed');
          let account = s.accounts.find(a => a.clientId === current.clientId && a.subject === claims.sub); const created = !account;
          if (s.accounts.length >= 10000 || s.sessions.length >= 1000 || s.outbox.filter(e => !e.delivered).length >= 1000) throw new Error('Provider capacity reached');
          if (!account) { account = { id: randomUUID(), clientId: current.clientId, subject: claims.sub, createdAt: new Date().toISOString() }; s.accounts.push(account); }
          s.sessions.push({ hash: sha256(sessionToken), clientId: current.clientId, accountId: account.id, expires: Date.now() + 86400000, claims, accountStatus: created ? 'created' : 'existing' });
          const event = s.outbox.find(e => e.clientId === current.clientId && e.referralId === claims.referral_id && e.subject === claims.sub) ?? { id: randomUUID(), clientId: current.clientId, referralId: claims.referral_id, subject: claims.sub, accountId: account.id, delivered: false };
          if (!s.outbox.includes(event)) s.outbox.push(event);
          flow.status = 'complete'; flow.sessionToken = sessionToken; return event.id;
        });
        await deliver(eventId);
        setCookie(response, config, `ep_session_${found.registration.clientId}`, sessionToken, 86400); redirect(response, destination); return;
      } catch {
        await store.update(s => { const flow = s.transactions.find(t => t.hash === found.flow.hash); if (flow && flow.status !== 'complete') flow.status = 'interrupted'; });
        redirect(response, `${destination}?interrupted=1&ref=${found.flow.transaction.referral}`); return;
      }
    }
    const match = /^\/providers\/([0-9a-f-]{36})(\/login|\/logout)?$/.exec(url.pathname);
    if (!match) { page(response, config, 'صفحه پیدا نشد', '<section class="panel"><h1>صفحه پیدا نشد</h1></section>', 404); return; }
    const clientId = match[1]!, registration = await store.update(s => s.registrations.find(r => r.clientId === clientId));
    if (!registration) throw new Error('Connection missing');
    await active(registration);
    const referral = url.searchParams.getAll('ref').length === 1 && tokenPattern.test(url.searchParams.get('ref')!) ? url.searchParams.get('ref')! : undefined;
    if (match[2] === '/login' && request.method === 'GET') {
      if (!referral) throw new Error('A current referral is required');
      await sdk(registration).acceptReferral(referral);
      const start = sdk(registration).begin(referral), binding = randomToken();
      await store.update(s => { if (s.transactions.length >= 1000) throw new Error('Transaction capacity reached'); s.transactions.push({ hash: sha256(binding), clientId, transaction: start.transaction, status: 'pending' }); });
      setCookie(response, config, 'ep_flow', binding, 600); redirect(response, start.url); return;
    }
    const sessionToken = cookie(request, `ep_session_${clientId}`);
    if (match[2] === '/logout' && request.method === 'POST') {
      if (request.headers['sec-fetch-site'] === 'cross-site' || (request.headers.origin && request.headers.origin !== origin.origin && request.headers.origin !== 'null')) throw new Error('Invalid form origin');
      let body = ''; for await (const chunk of request) { body += String(chunk); if (body.length > 1024) throw new Error('Form too large'); }
      const form = new URLSearchParams(body);
      // HTML form POSTs can carry Origin:null under no-referrer. Bind the form
      // to its HttpOnly session instead of treating that header as authority.
      if (!request.headers['content-type']?.startsWith('application/x-www-form-urlencoded') || !sessionToken || form.getAll('csrf').length !== 1 || !constantEqual(form.get('csrf') ?? '', sha256(`${sessionToken}:logout`))) throw new Error('Invalid form token');
      await store.update(s => { if (sessionToken) s.sessions = s.sessions.filter(session => session.hash !== sha256(sessionToken) || session.clientId !== clientId); });
      setCookie(response, config, `ep_session_${clientId}`, '', 0); redirect(response, `/providers/${clientId}`); return;
    }
    if (match[2] || request.method !== 'GET') throw new Error('Method unavailable');
    const result = await store.update(s => { const session = sessionToken && s.sessions.find(session => session.clientId === clientId && session.hash === sha256(sessionToken)); const account = session && s.accounts.find(a => a.id === session.accountId && a.clientId === clientId); return session && account ? { session, account } : undefined; });
    const banner = url.searchParams.has('cancelled') ? '<p class="notice" role="status">اجازه دسترسی داده نشد. اطلاعات جدیدی دریافت نشد.</p>' : url.searchParams.has('interrupted') ? '<p class="notice" role="status">ورود کامل نشد. از پیشنهاد ترب‌تیکت دوباره ادامه دهید.</p>' : '';
    const continueLink = referral ? `<a class="button" href="/providers/${clientId}/login?ref=${referral}">ادامه با ترب‌تیکت</a>` : `<a class="button" href="${escapeHtml(config.issuerOrigin)}">انتخاب پیشنهاد در ترب‌تیکت ↗</a>`;
    const body = `<section class="intro"><span class="eyebrow">${escapeHtml(registration.providerName)}</span><h1>${result ? 'خوش آمدید، '+escapeHtml(result.session.claims.traveler_profile!.givenName) : 'سفر شما، یک قدم نزدیک‌تر'}</h1><p>${result ? 'مشخصات مسافر با اجازه شما دریافت شد.' : 'برای ورود و تکمیل مشخصات مسافر، با حساب ترب‌تیکت ادامه دهید.'}</p></section>${banner}`;
    if (!result) { page(response, config, registration.providerName, body + `<section class="panel">${continueLink}</section>`); return; }
    const payload = { provider_account: { id: result.account.id, status: result.session.accountStatus, created_at: result.account.createdAt }, identity: result.session.claims };
    page(response, config, registration.providerName, body + `<section class="panel"><div class="panel-heading"><h2>${result.session.accountStatus === 'created' ? 'حساب شما ایجاد شد' : 'وارد حساب قبلی شدید'}</h2><form action="/providers/${clientId}/logout" method="post"><input type="hidden" name="csrf" value="${sha256(`${sessionToken}:logout`)}"><button class="quiet">خروج از حساب</button></form></div><p>اطلاعات دریافت‌شده از ترب‌تیکت</p><pre id="sso-response" dir="ltr" tabindex="0" aria-label="SSO response JSON">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>${referral ? continueLink : ''}</section>`);
  }
  return { server, store, retryReports };
}
