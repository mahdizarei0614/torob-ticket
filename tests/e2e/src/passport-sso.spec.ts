import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SearchRecoverySchema } from '@torob-ticket/contracts';

const sample = { givenName: 'سارا', familyName: 'احمدی', latinGivenName: 'Sara', latinFamilyName: 'Ahmadi', birthDate: '1992-03-04', nationalId: '0012345678', passport: { number: 'A12345678', issuingCountry: 'IR', expiresOn: '2030-01-01' } };
type Scope = 'domestic' | 'international';

// All mutations are made through the visible reviewer UI. The GET only reads the
// search the reviewer just submitted so the test can choose RoadAra's exact card.
async function openProvider(page: Page, context: BrowserContext, scope: Scope, direct = false) {
  await page.getByRole('button', { name: 'سفرهای پیشنهادی', exact: true }).click();
  await page.getByRole('button', { name: scope === 'international' ? /^پرواز بین‌المللی ·/ : /^پرواز داخلی ·/ }).click();
  await expect(page.locator('[data-date-price-status]').first()).toHaveAttribute('data-date-price-status', 'complete', { timeout: 30000 });
  const starting = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/searches' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
  const started = SearchRecoverySchema.parse(await (await starting).json());
  const results = page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
  await expect(results).toHaveAttribute('data-status', 'complete', { timeout: 20000 });
  const snapshot = SearchRecoverySchema.parse(await (await context.request.get(`/api/v1/searches/${started.snapshot.searchId}`)).json()).snapshot;
  expect(snapshot.query.scope).toBe(scope);
  const group = snapshot.groups.find(g => g.eligibleQuotes.some(q => q.providerId === 'demo-provider-01'))!;
  const quote = group.eligibleQuotes.find(q => q.providerId === 'demo-provider-01')!;
  const card = results.locator(`article[data-group-id="${group.groupId}"][data-amount-rial="${quote.total.amountRial}"]`).first();
  await card.locator('[data-card-select]').click();
  const opening = page.waitForEvent('popup');
  await card.locator('[data-seller-link-quote-id][data-provider-id="demo-provider-01"]').first().click();
  const provider = await opening;
  if (!direct) {
    await provider.getByRole('link', { name: 'رفتن به سایت فروشنده', exact: true }).click();
    expect(new URL(provider.url()).hostname).not.toBe(new URL(page.url()).hostname);
    expect(await provider.locator('a[href]').evaluateAll(links => links.every(link => new URL(link.getAttribute('href')!, location.href).origin === location.origin))).toBe(true);
  }
  await provider.getByRole('link', { name: 'ادامه با ترب‌تیکت', exact: true }).click();
  return provider;
}

async function verifyPhone(page: Page, phone: string) {
  await page.getByLabel('شماره همراه', { exact: true }).fill(phone);
  await page.getByRole('button', { name: 'دریافت کد تأیید', exact: true }).click();
  await page.getByLabel('کد تأیید', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'تأیید و ورود', exact: true }).click();
}

async function fillProfile(page: Page, international: boolean) {
  await page.getByLabel('نام', { exact: true }).fill(sample.givenName);
  await page.getByLabel('نام خانوادگی', { exact: true }).fill(sample.familyName);
  await page.getByLabel('تاریخ تولد (میلادی)', { exact: true }).fill(sample.birthDate);
  await page.getByRole('combobox', { name: 'جنسیت', exact: true }).selectOption('female');
  if (international) {
    await page.getByLabel('نام لاتین', { exact: true }).fill(sample.latinGivenName);
    await page.getByLabel('نام خانوادگی لاتین', { exact: true }).fill(sample.latinFamilyName);
    await page.getByLabel('شماره گذرنامه', { exact: true }).fill(sample.passport.number);
    await page.getByLabel('کد کشور صادرکننده', { exact: true }).fill(sample.passport.issuingCountry);
    await page.getByLabel('انقضای گذرنامه (میلادی)', { exact: true }).fill(sample.passport.expiresOn);
  } else await page.getByLabel('کد ملی', { exact: true }).fill(sample.nationalId);
  await page.getByRole('button', { name: 'ذخیره مشخصات مسافر', exact: true }).click();
  await expect(page.getByRole('button', { name: 'اجازه و ادامه', exact: true })).toBeEnabled();
  if (international) {
    await expect(page.getByText(sample.latinGivenName, { exact: true })).toBeVisible();
    await expect(page.getByText(sample.latinFamilyName, { exact: true })).toBeVisible();
    await expect(page.getByText(sample.passport.number, { exact: true })).toBeVisible();
  }
}

async function approve(page: Page) {
  await page.getByRole('button', { name: 'اجازه و ادامه', exact: true }).click();
  await expect(page.locator('#sso-response')).toBeVisible();
  return JSON.parse(await page.locator('#sso-response').innerText());
}

test('fresh international reviewer shares passport and English names with new and existing provider accounts', async ({ page, context }, info) => {
  test.setTimeout(120000);
  const root = process.env.PASSPORT_SSO_EVIDENCE_DIR ?? info.outputPath('captures'); mkdirSync(root, { recursive: true });
  expect(await context.cookies()).toHaveLength(0);
  const canonical = new URL(info.project.use.baseURL!);
  const alias = new URL(canonical); alias.hostname = canonical.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  await page.goto(alias.href);
  expect(new URL(page.url()).origin).toBe(canonical.origin);
  const first = await openProvider(page, context, 'international', true);
  await verifyPhone(first, '09000000891');
  await expect(first.getByLabel('نام لاتین', { exact: true })).toBeVisible();
  await expect(first.getByLabel('شماره گذرنامه', { exact: true })).toBeVisible();
  await expect(first.getByLabel('کد ملی', { exact: true })).toHaveCount(0);
  await first.screenshot({ path: resolve(root, 'international-required-fields.png'), fullPage: true });
  await fillProfile(first, true);
  const created = await approve(first);
  expect(created.provider_account.status).toBe('created');
  expect(created.identity.traveler_profile).toMatchObject({ latinGivenName: sample.latinGivenName, latinFamilyName: sample.latinFamilyName, passport: sample.passport });
  expect(created.identity.traveler_profile).not.toHaveProperty('nationalId');
  await expect(first.locator('.traveler-panel')).toContainText(sample.passport.number);
  await expect(first.locator('.traveler-panel')).toContainText(sample.latinFamilyName);
  await first.locator('.traveler-panel').screenshot({ path: resolve(root, 'international-approved-profile.png') });
  await first.screenshot({ path: resolve(root, 'international-created.png'), fullPage: true });
  await first.getByRole('button', { name: 'خروج از حساب', exact: true }).click(); await first.close();
  const repeat = await openProvider(page, context, 'international', true);
  await expect(repeat.getByRole('button', { name: 'اجازه و ادامه', exact: true })).toBeEnabled();
  await expect(repeat.getByText(sample.passport.number, { exact: true })).toBeVisible();
  await repeat.screenshot({ path: resolve(root, 'international-repeat-consent.png'), fullPage: true });
  const existing = await approve(repeat);
  expect(existing.provider_account.status).toBe('existing'); expect(existing.provider_account.id).toBe(created.provider_account.id);
  expect(existing.identity.traveler_profile).toEqual(created.identity.traveler_profile);
  await repeat.screenshot({ path: resolve(root, 'international-existing.png'), fullPage: true });
  writeFileSync(resolve(root, 'international-checks.json'), JSON.stringify({ initialCookies: 0, uiSearchAndProviderSelection: true, created: created.provider_account.status, repeat: existing.provider_account.status, sameAccount: existing.provider_account.id === created.provider_account.id, approvedProfile: existing.identity.traveler_profile }, null, 2));
});

test('existing domestic profile requests missing passport and English names for an international trip', async ({ page, context }, info) => {
  test.setTimeout(120000);
  const root = process.env.PASSPORT_SSO_EVIDENCE_DIR ?? info.outputPath('captures'); mkdirSync(root, { recursive: true });
  expect(await context.cookies()).toHaveLength(0); await page.goto('/');
  const domestic = await openProvider(page, context, 'domestic');
  await verifyPhone(domestic, '09000000892'); await fillProfile(domestic, false);
  const created = await approve(domestic);
  expect(created.provider_account.status).toBe('created'); expect(created.identity.traveler_profile.nationalId).toBe(sample.nationalId);
  expect(created.identity.traveler_profile).not.toHaveProperty('passport'); expect(created.identity.traveler_profile).not.toHaveProperty('latinGivenName');
  await domestic.getByRole('button', { name: 'خروج از حساب', exact: true }).click(); await domestic.close();
  const international = await openProvider(page, context, 'international');
  await expect(international.getByLabel('نام لاتین', { exact: true })).toBeVisible();
  await expect(international.getByLabel('شماره گذرنامه', { exact: true })).toBeVisible();
  await expect(international.getByLabel('نام', { exact: true })).toHaveValue(sample.givenName);
  await expect(international.getByRole('button', { name: 'اجازه و ادامه', exact: true })).toBeDisabled();
  await international.screenshot({ path: resolve(root, 'returning-missing-fields.png'), fullPage: true });
  await fillProfile(international, true);
  const existing = await approve(international);
  expect(existing.provider_account.status).toBe('existing'); expect(existing.provider_account.id).toBe(created.provider_account.id);
  expect(existing.identity.traveler_profile).toMatchObject({ latinGivenName: sample.latinGivenName, latinFamilyName: sample.latinFamilyName, passport: sample.passport });
  expect(existing.identity.traveler_profile).not.toHaveProperty('nationalId');
  await international.locator('.traveler-panel').screenshot({ path: resolve(root, 'returning-approved-profile.png') });
  await international.screenshot({ path: resolve(root, 'returning-international-existing.png'), fullPage: true });
  writeFileSync(resolve(root, 'returning-checks.json'), JSON.stringify({ initialCookies: 0, domesticCreated: true, internationalExisting: true, sameAccount: existing.provider_account.id === created.provider_account.id, approvedProfile: existing.identity.traveler_profile }, null, 2));
});
