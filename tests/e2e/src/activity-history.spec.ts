import {expect,test,type BrowserContext,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DirectAdminSchema,PopulateTrafficSchema,ProviderTrafficSchema} from '@torob-ticket/contracts';

const totals=(page:Page)=>page.locator('[aria-label="Traffic totals"] article').filter({hasText:'Outbound referrals'}).locator('strong');
const read=async(context:BrowserContext,query='')=>{const response=await context.request.get(new URL('/api/v1/admin/traffic'+query,process.env.E2E_BASE_URL).href);expect(response.status()).toBe(200);return ProviderTrafficSchema.parse(await response.json());};

test('fresh Docker reviewers start with private activity history and retain their SSO connection',async({page,context,browser},info)=>{
 test.setTimeout(180000);
 const root=process.env.ACTIVITY_HISTORY_EVIDENCE_DIR??info.outputPath('captures');mkdirSync(root,{recursive:true});
 const capture=async(name:string)=>page.screenshot({path:resolve(root,name+'.png'),fullPage:true});
 expect(await context.cookies()).toHaveLength(0);
 let populateRequests=0;context.on('request',request=>{if(new URL(request.url()).pathname==='/api/v1/admin/traffic/populate'&&request.method()==='POST')populateRequests++;});
 await page.goto(new URL('/admin/',process.env.ADMIN_E2E_URL).href);
 await expect(page.getByRole('heading',{name:'Provider traffic',exact:true})).toBeVisible();
 const direct=async()=>{const r=await context.request.get(new URL('/api/v1/admin/direct-login',process.env.E2E_BASE_URL).href);expect(r.status()).toBe(200);return DirectAdminSchema.parse(await r.json());};
 await expect.poll(async()=>{const r=await context.request.get(new URL('/api/v1/admin/direct-login',process.env.E2E_BASE_URL).href);if(!r.ok())return false;return DirectAdminSchema.parse(await r.json()).partners.find(p=>p.providerId==='demo-provider-01')?.enabled;},{timeout:20000}).toBe(true);
 const connection=await direct();let overview=await read(context);const monthKeys=[...overview.availableMonths].sort();expect(monthKeys).toHaveLength(3);
 expect(populateRequests).toBe(0);expect(overview.totals.outbound).toBeGreaterThan(1000);await expect(totals(page)).toHaveText(overview.totals.outbound.toLocaleString('en-GB'));
 await expect(page.getByRole('table',{name:'Provider referral traffic'}).locator('tbody tr')).toHaveCount(6);
 for(const tier of [1,2,3])await expect(page.getByText(new RegExp('Next billable referral · tier '+tier+' ·')).first()).toBeVisible();
 expect(overview.totals.outbound).toBeGreaterThan(1000);expect(overview.totals.repeats).toBeGreaterThan(0);
 await capture('current-month');
 const chart=page.getByRole('img',{name:/Daily outbound and billable referrals/});await expect(chart).toBeVisible();await chart.screenshot({path:resolve(root,'daily-chart.png')});
 async function filter(label:string,value:string,param:string){
  const changed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/admin/traffic'&&(new URL(r.url()).searchParams.get(param)??'')===value&&r.status()===200);
  await page.getByRole('combobox',{name:new RegExp('^'+label+'(?:\\s|$)')}).selectOption(value);const result=ProviderTrafficSchema.parse(await(await changed).json());await expect(totals(page)).toHaveText(result.totals.outbound.toLocaleString('en-GB'));return result;
 }
 const historical=await filter('Billing month',monthKeys[0]!,'month');expect(historical.totals.unpricedBillable).toBeGreaterThan(0);await expect(page.getByText('Closed month · fees use recorded rates').first()).toBeVisible();await capture('historical-month');
 const selected=await filter('Provider','demo-provider-02','providerId');expect(selected.providers).toHaveLength(1);
 const hotels=await filter('Referral type','hotel','kind');expect(hotels.totals.hotel).toBe(hotels.totals.outbound);expect(hotels.totals.transport).toBe(0);await capture('provider-hotel-filter');
 await filter('Referral type','transport','kind');
 await page.getByRole('table',{name:'Outbound referral records'}).getByRole('link',{name:'View referral',exact:true}).first().click();
 await expect(page.getByRole('heading',{name:'Referral trail',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Search-to-source lineage',exact:true})).toBeVisible();await capture('referral-trail');
 const source=page.locator('a[href*="/searches/activity-"]').first();await expect(source).toBeVisible();await source.click();await expect(page).toHaveURL(/\/admin\/searches\/activity-/);await expect(page.getByRole('heading',{name:'Processing evidence',exact:true})).toBeVisible();
 for(const section of ['raw','normalizations','quotes']){
  await page.getByRole('button',{name:section,exact:true}).click();await expect(page.getByText(section+' record 1',{exact:true})).toBeVisible();await page.getByText(section+' record 1',{exact:true}).click();await capture('source-inspection-'+section);
 }
 const health=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/admin/providers');await page.getByRole('navigation',{name:'Operations'}).getByRole('link',{name:/Providers$/}).click();expect((await health).status()).toBe(200);await expect(page.getByRole('heading',{name:'Providers',exact:true})).toBeVisible();await page.getByText(/^Recorded status history /).first().click();await expect(page.locator('a[href*="/searches/activity-"]').first()).toBeVisible();await capture('provider-health');
 await page.getByRole('navigation',{name:'Operations'}).getByRole('link',{name:/Traffic$/}).click();await expect(page.getByRole('heading',{name:'Provider traffic',exact:true})).toBeVisible();
 overview=await read(context);await expect(totals(page)).toHaveText(overview.totals.outbound.toLocaleString('en-GB'));
 await page.getByRole('button',{name:'Configuration',exact:true}).click();
 const repeat=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/admin/traffic/populate'&&r.request().method()==='POST');await page.getByRole('dialog').getByRole('button',{name:'Load activity history',exact:true}).click();
 const summary=PopulateTrafficSchema.parse(await(await repeat).json());expect(summary.status).toBe('already-loaded');expect(summary.providerCount).toBe(6);expect(summary.monthKeys).toEqual(monthKeys);await expect(page.getByRole('dialog')).toHaveCount(0);
 expect((await read(context)).totals).toEqual(overview.totals);expect((await direct()).partners).toEqual(connection.partners);
 const peer=await browser.newContext();
 try{const other=await peer.newPage();await other.goto(new URL('/admin/',process.env.ADMIN_E2E_URL).href);await expect(totals(other)).toHaveText(overview.totals.outbound.toLocaleString('en-GB'),{timeout:20000});expect((await read(peer)).totals).toEqual(overview.totals);const r=await peer.request.get(new URL('/api/v1/admin/direct-login',process.env.E2E_BASE_URL).href);expect(r.status()).toBe(200);const partner=DirectAdminSchema.parse(await r.json()).partners.find(p=>p.providerId==='demo-provider-01');expect(partner?.enabled).toBe(true);expect(partner?.clientId).not.toBe(connection.partners.find(p=>p.providerId==='demo-provider-01')?.clientId);}finally{await peer.close();}
 writeFileSync(resolve(root,'checks.json'),JSON.stringify({initialCookies:0,summary,currentMonth:overview.totals,historicalMonth:historical.totals,filteredHotel:hotels.totals,idempotent:true,separateReviewerPopulated:true,automaticBeforeAnyPopulatePost:true,ssoConnectionUnchanged:true,allMutationsThroughUI:true},null,2)+'\n');
});
