import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {BrowserContext,Page} from '@playwright/test';
import {ProviderTrafficSchema,ProviderTariffSchema,ReferralReceiptSchema,RecheckResultSchema,type ReferralReceipt} from '@torob-ticket/contracts';
import {test,expect,loadQuery,runSearch,queryFor,resultRegion} from '../fixtures';
test.use({trace:'off'});
const evidence=process.env.PROVIDER_TRAFFIC_EVIDENCE_DIR??'.local/evidence/adjustments/provider-traffic-revenue/browser';
const save=(name:string,value:unknown)=>{mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n');};
const capture=async(page:Page,name:string)=>{mkdirSync(evidence,{recursive:true});await page.screenshot({path:join(evidence,name+'.png')});};
const traffic=async(context:BrowserContext,params:Record<string,string>={})=>{const response=await context.request.get('/api/v1/admin/traffic',{params});expect(response.status()).toBe(200);return ProviderTrafficSchema.parse(await response.json());};
const metric=(page:Page,name:string)=>page.locator('[aria-label="Traffic totals"] article').filter({hasText:name}).locator('strong');
async function recheckAndConfirm(context:BrowserContext,previous:ReferralReceipt){
 const response=await context.request.post('/api/v1/referrals/prepare',{data:previous.selection});expect(response.status()).toBe(201);const checked=RecheckResultSchema.parse(await response.json());expect(checked.status).toBe('ready');if(checked.status!=='ready')throw Error('Expected unchanged current source quote');
 const confirm=await context.request.post('/api/v1/referrals/confirm',{data:{intentId:checked.intent.intentId,acceptedQuoteVersion:checked.intent.selection.quoteVersion,idempotencyKey:randomUUID()}});expect(confirm.status()).toBe(201);return ReferralReceiptSchema.parse(await confirm.json());
}
async function send(context:BrowserContext,receipt:ReferralReceipt){const response=await context.request.get('/api/v1/referrals/'+receipt.referralId+'/outbound',{maxRedirects:0});expect(response.status()).toBe(302);expect(response.headers()['location']).toBe('https://zarei.xyz');}

test('@provider-traffic real popup delivery, distinct visitors and prospective rates drive the admin overview',async({newReviewer,browser})=>{
 test.setTimeout(120000);
 const reviewer=await newReviewer({seed:8686,scenario:'normal',anchorInstant:'2026-11-03T06:00:00Z',viewport:{width:1440,height:1000},reducedMotion:'reduce'}),{page,context}=reviewer;
 const additional:BrowserContext[]=[];
 try{
  await page.addInitScript(()=>{const open=window.open.bind(window);let first=true;window.open=((...args:Parameters<typeof window.open>)=>{if(first){first=false;return null;}return open(...args);}) as typeof window.open;});
  // Only the already-authorized external placeholder is substituted. All local
  // searches, confirmations, redirect302s, traffic reports and rate writes are real.
  await context.route(/^https:\/\/zarei\.xyz(?:\/|$)/,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Provider destination observed</title>'}));
  await page.goto('/admin/');await expect(page.getByRole('heading',{name:'Provider traffic',exact:true})).toBeVisible();await expect(metric(page,'Outbound referrals')).toHaveText('0');
  const empty=await traffic(context);expect(empty.totals.outbound).toBe(0);await capture(page,'empty-dashboard');
  const query=queryFor('flight','domestic','one-way',{departureDate:'2026-11-08'});await loadQuery(reviewer,query);const recovery=await runSearch(reviewer);
  const displayed=new Set(await resultRegion(page).locator('article[data-quote-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-quote-id'))));
  const quote=recovery.snapshot.groups.flatMap(group=>group.eligibleQuotes).find(candidate=>displayed.has(candidate.quoteId));if(!quote)throw Error('Expected a displayed eligible offer');
  const card=resultRegion(page).locator(`article[data-quote-id="${quote.quoteId}"]`);if(await card.getAttribute('data-selected')!=='true')await card.locator('[data-card-select]').press('Space');await expect(card).toHaveAttribute('data-selected','true');
  const confirmation=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/referrals/confirm'&&response.request().method()==='POST');
  await card.locator(`[data-seller-link-quote-id="${quote.quoteId}"]`).click();const confirmed=await confirmation;expect(confirmed.status()).toBe(201);const first=ReferralReceiptSchema.parse(await confirmed.json());
  await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase','handoff-error');expect((await traffic(context)).totals.outbound).toBe(0);await capture(page,'popup-blocked-not-counted');
  const redirects:{status:number;path:string}[]=[];context.on('response',response=>{const path=new URL(response.url()).pathname;if(path===`/api/v1/referrals/${first.referralId}/outbound`)redirects.push({status:response.status(),path});});
  const opened=page.waitForEvent('popup');await page.getByRole('button',{name:'باز کردن صفحه فروشنده',exact:true}).click();const popup=await opened;await popup.waitForURL(/^https:\/\/zarei\.xyz(?:\/|$)/);expect(await popup.evaluate(()=>window.opener===null)).toBe(true);await popup.close();await page.bringToFront();
  await expect.poll(async()=>(await traffic(context)).totals.outbound).toBe(1);expect(redirects.some(item=>item.status===302)).toBe(true);
  await send(context,first);expect((await traffic(context)).totals).toMatchObject({outbound:1,billable:1,uniqueVisitorSessions:1,unpricedBillable:1});
  const second=await recheckAndConfirm(context,first);expect((await traffic(context)).totals.outbound).toBe(1);await send(context,second);expect((await traffic(context)).totals).toMatchObject({outbound:2,billable:1,repeats:1,uniqueVisitorSessions:1});
  const auth=(await context.cookies()).find(cookie=>cookie.name==='torob_demo');if(!auth)throw Error('Owned workspace credential missing');
  async function browserVisitor(){const next=await browser.newContext({baseURL:new URL(page.url()).origin,reducedMotion:'reduce'});additional.push(next);await next.addCookies([auth!]);const bootstrap=await next.request.get('/api/v1/demo/session');expect(bootstrap.status()).toBe(200);expect((await next.cookies()).filter(cookie=>cookie.name.startsWith('torob_traffic_visitor_')).length).toBe(1);return next;}
  const browserB=await browserVisitor(),third=await recheckAndConfirm(browserB,second);await send(browserB,third);
  const beforeRates=await traffic(context);expect(beforeRates.totals).toMatchObject({outbound:3,billable:2,repeats:1,uniqueVisitorSessions:2,knownFeeRial:0,unpricedBillable:2});
  await page.goto('/admin/');await expect(metric(page,'Outbound referrals')).toHaveText('3');await expect(metric(page,'Unique visitor sessions')).toHaveText('2');await expect(metric(page,'Billable referrals')).toHaveText('2');
  const providerId=first.payload.quote.providerId;await page.getByRole('combobox',{name:'Provider',exact:true}).selectOption(providerId);await expect(page.locator('[data-traffic-provider]')).toHaveCount(1);await expect(metric(page,'Outbound referrals')).toHaveText('3');
  await page.getByRole('combobox',{name:'Referral type',exact:true}).selectOption('hotel');await expect(metric(page,'Outbound referrals')).toHaveText('0');await expect(page.getByRole('heading',{name:'No outbound referrals in this period'})).toBeVisible();
  const hotelFilter=await traffic(context,{providerId,kind:'hotel'});expect(hotelFilter.totals.outbound).toBe(0);expect(hotelFilter.daily.every(day=>day.counts.outbound===0)).toBe(true);
  await page.getByRole('combobox',{name:'Referral type',exact:true}).selectOption('transport');await expect(metric(page,'Outbound referrals')).toHaveText('3');
  const row=page.locator(`[data-traffic-provider="${providerId}"]`);await row.getByRole('button',{name:/^Set referral pricing for/}).click();const pricing=page.getByRole('dialog');await expect(pricing.getByRole('heading',{name:/Referral pricing/})).toBeVisible();
  for(const [tier,rate] of [[1,'150'],[2,'200'],[3,'300']] as const)await pricing.getByLabel(`Tier ${tier} fee in toman`).fill(rate);
  await capture(page,'pricing-editor');const patch=page.waitForResponse(response=>response.request().method()==='PATCH'&&new URL(response.url()).pathname.endsWith('/tariff'));await pricing.getByRole('button',{name:'Save future rates',exact:true}).click();const patched=await patch;expect(patched.status()).toBe(200);const tariff=ProviderTariffSchema.parse(await patched.json());expect(tariff.tiers.map(tier=>tier.rateRial)).toEqual([1500,2000,3000]);await expect(pricing).toHaveCount(0);
  const unchanged=await traffic(context);expect(unchanged.totals).toMatchObject({knownFeeRial:0,unpricedBillable:2});
  const browserC=await browserVisitor(),fourth=await recheckAndConfirm(browserC,third);await send(browserC,fourth);
  const final=await traffic(context,{providerId,kind:'transport'});expect(final.totals).toMatchObject({outbound:4,billable:3,repeats:1,uniqueVisitorSessions:3,knownFeeRial:1500,unpricedBillable:2});expect(final.providers.find(provider=>provider.providerId===providerId)?.counts).toEqual(final.totals);expect(final.daily.reduce((n,day)=>n+day.counts.outbound,0)).toBe(4);expect(final.events.items.find(event=>event.referralId===fourth.referralId)).toMatchObject({rateRial:1500,monthOrdinal:3,tariffRevision:tariff.revision});
  await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(metric(page,'Outbound referrals')).toHaveText('4');await expect(metric(page,'Unique visitor sessions')).toHaveText('3');await capture(page,'populated-desktop');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('heading',{name:'Provider traffic',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await capture(page,'populated-mobile');
  save('traffic-proof',{browser:browser.version(),source:'Actual consumer quote/recheck/confirmation, deliberately blocked first popup, real same-origin tracked302 and only external placeholder stub. Later valid confirmations reuse the preceding genuine current quote version; no manufactured receipt/event/price response. Two extra browser contexts copy only the owned workspace auth cookie and obtain distinct server-minted visitor cookies via explicit GETbootstrap. No credential or cookie values recorded.',redirects,firstReceipt:first.referralId,providerId,blockedTraffic:0,beforeRates,tariff,final,additionalVisitorContexts:additional.length});
 }finally{await Promise.allSettled(additional.map(item=>item.close()));}
});
