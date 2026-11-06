import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DirectAdminSchema, ReferralReceiptSchema, RecheckResultSchema, SearchRecoverySchema, SessionInfoSchema } from '@torob-ticket/contracts';

// This context starts exactly like a reviewer: no admin enrollment or seeded
// credentials, identities, profiles or accounts. Docker owns the local defaults.
test('fresh reviewer can use external SSO without configuring a provider', async ({page,context},info) => {
  const root=process.env.REVIEWER_SSO_EVIDENCE_DIR ?? info.outputPath('captures'); mkdirSync(root,{recursive:true});
  await page.goto('/');
  let registration: ReturnType<typeof DirectAdminSchema.parse>['partners'][number] | undefined;
  await expect.poll(async()=>{
    const response=await context.request.get('/api/v1/admin/direct-login');
    if(!response.ok())return false;
    registration=DirectAdminSchema.parse(await response.json()).partners.find(p=>p.providerId==='demo-provider-01');return registration?.enabled;
  },{timeout:20000}).toBe(true);
  expect(registration?.kind).toBe('external');expect(registration?.exampleSiteUrl).toBeTruthy();expect(registration?.acquisitionRateRial).toBeNull();
  const current=SessionInfoSchema.parse(await(await context.request.get('/api/v1/demo/session')).json());
  const date=new Date(current.anchorInstant);date.setUTCDate(date.getUTCDate()+1);const departureDate=date.toISOString().slice(0,10);
  const result=SearchRecoverySchema.parse(await(await context.request.post('/api/v1/searches',{data:{query:{mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate,party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'},clientGeneration:randomUUID()}})).json());
  let snapshot=result.snapshot;
  await expect.poll(async()=>{snapshot=SearchRecoverySchema.parse(await(await context.request.get(`/api/v1/searches/${snapshot.searchId}`)).json()).snapshot;return snapshot.status;},{timeout:15000}).toBe('complete');
  const quote=snapshot.groups.flatMap(g=>g.eligibleQuotes).find(q=>q.providerId==='demo-provider-01')!;expect(quote).toBeTruthy();
  const checked=RecheckResultSchema.parse(await(await context.request.post('/api/v1/referrals/prepare',{data:{kind:'transport',quoteId:quote.quoteId,quoteVersion:quote.version}})).json());if(checked.status==='unavailable')throw Error('Expected available referral');
  const receipt=ReferralReceiptSchema.parse(await(await context.request.post('/api/v1/referrals/confirm',{data:{intentId:checked.intent.intentId,acceptedQuoteVersion:checked.intent.selection.quoteVersion,idempotencyKey:randomUUID()}})).json());
  await page.goto(`/api/v1/referrals/${receipt.referralId}/outbound`);await expect(page.getByRole('link',{name:'ادامه با ترب‌تیکت',exact:true})).toBeVisible();await page.screenshot({path:resolve(root,'ready-choice.png'),fullPage:true});
  await page.getByRole('link',{name:'رفتن به سایت فروشنده',exact:true}).click();await page.getByRole('link',{name:'ادامه با ترب‌تیکت',exact:true}).click();
  await page.getByLabel('شماره همراه',{exact:true}).fill('09000000991');await page.getByRole('button',{name:'دریافت کد تأیید',exact:true}).click();await page.getByLabel('کد تأیید',{exact:true}).fill('123456');await page.getByRole('button',{name:'تأیید و ورود',exact:true}).click();
  await page.getByLabel('نام',{exact:true}).fill('سارا');await page.getByLabel('نام خانوادگی',{exact:true}).fill('احمدی');await page.getByLabel('تاریخ تولد (میلادی)',{exact:true}).fill('1992-03-04');await page.getByRole('combobox',{name:'جنسیت',exact:true}).selectOption('female');await page.getByLabel('کد ملی',{exact:true}).fill('0012345678');await page.getByRole('button',{name:'ذخیره مشخصات مسافر',exact:true}).click();await page.getByRole('button',{name:'اجازه و ادامه',exact:true}).click();
  const json=page.locator('pre#sso-response');await expect(json).toBeVisible();const created=JSON.parse(await json.innerText());expect(created.provider_account.status).toBe('created');expect(created.identity.phone_number).toBe('+989000000991');expect(created.identity.traveler_profile.givenName).toBe('سارا');expect(created.identity.attribution).toBe('pending');await page.screenshot({path:resolve(root,'created-json.png'),fullPage:true});
  await page.getByRole('button',{name:'خروج از حساب',exact:true}).click();await expect(json).toHaveCount(0);
  await page.goto(`/api/v1/direct-login/start/${receipt.referralId}`);await page.getByRole('button',{name:'اجازه و ادامه',exact:true}).click();await expect(json).toBeVisible();const existing=JSON.parse(await json.innerText());expect(existing.provider_account.status).toBe('existing');expect(existing.provider_account.id).toBe(created.provider_account.id);await page.screenshot({path:resolve(root,'existing-json.png'),fullPage:true});
  const peer=await context.browser()!.newContext();
  try {const next=await peer.newPage();await next.goto(process.env.E2E_BASE_URL!);await expect.poll(async()=>{const response=await peer.request.get(new URL('/api/v1/admin/direct-login',process.env.E2E_BASE_URL).href);if(!response.ok())return undefined;return DirectAdminSchema.parse(await response.json()).partners[0]?.enabled;},{timeout:20000}).toBe(true);const other=DirectAdminSchema.parse(await(await peer.request.get(new URL('/api/v1/admin/direct-login',process.env.E2E_BASE_URL).href)).json());expect(other.partners[0]?.clientId).not.toBe(registration?.clientId);expect(other.acquisitions).toHaveLength(0);}finally{await peer.close();}
});
