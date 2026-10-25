import { test, expect, type Page } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const evidence=process.env.T16_CORRECTION_EVIDENCE_DIR;
function record(name:string,data:unknown){if(evidence){mkdirSync(evidence,{recursive:true});writeFileSync(resolve(evidence,name),JSON.stringify(data,null,2));}}
async function ready(page:Page){await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:12000});}
async function resetOwn(page:Page){await page.request.post('/api/v1/demo/reset');}
test.describe('@dates-correction controlled freshness and authorization',()=>{
  test.beforeEach(async({page},info)=>{page.on('response',async response=>{if(response.url().endsWith('/api/v1/demo/session'))record(info.title.slice(0,40).replace(/[^a-z0-9]+/gi,'-')+'-session.json',{session:await response.json(),viewport:page.viewportSize()});});});
  test('physical wheel settle cannot commit after native Back to the same selected date',async({page})=>{
    let searches=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/v1/searches'))searches++;});
    try{await page.goto('/');await ready(page);const explorer=page.getByRole('region',{name:'کاوش تاریخ سفر'});const date=await explorer.getAttribute('data-selected-outbound');await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();await expect(page.getByText('درخواست جست‌وجو برای',{exact:false})).toBeVisible();expect(searches).toBe(1);
      const wheel=page.getByRole('listbox',{name:'روزهای نزدیک'});await wheel.scrollIntoViewIfNeeded();const box=(await wheel.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+140);await page.mouse.wheel(0,54);await expect(wheel).not.toHaveAttribute('data-preview-date',date!);await page.goBack();await page.waitForTimeout(350);
      expect(searches).toBe(1);await expect(explorer).toHaveAttribute('data-selected-outbound',date!);await expect(wheel).toHaveAttribute('data-preview-date',date!);expect(new URL(page.url()).search).toBe('');
      await page.getByRole('button',{name:'روز بعد',exact:true}).click();await expect.poll(()=>searches).toBe(2);await expect(page.getByText('درخواست جست‌وجو برای',{exact:false})).toBeVisible();record('physical-history.json',{date,searches,oldSettleCancelled:true,newGestureSearchesOnce:true,url:page.url(),userAgent:await page.evaluate(()=>navigator.userAgent)});
    }finally{await resetOwn(page);}
  });
  test('native history discards a provisional calendar from the old whole-party basis',async({page})=>{
    const requests:{party:unknown;date:string}[]=[];page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/v1/searches')){const q=request.postDataJSON().query;requests.push({party:q.party,date:q.departureDate});}});
    try{await page.goto('/');await ready(page);await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();await expect(page.getByText('درخواست جست‌وجو برای',{exact:false})).toBeVisible();const original=(await page.getByRole('region',{name:'کاوش تاریخ سفر'}).getAttribute('data-selected-outbound'))!;const next=await page.evaluate(date=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);},original);
      await page.getByLabel('تعداد بزرگسال',{exact:true}).fill('2');const trigger=page.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'});await trigger.click();await page.getByLabel('تاریخ رفت میلادی در تقویم',{exact:true}).fill(next);await page.goBack();await expect(page.getByRole('dialog',{name:'انتخاب تاریخ سفر'})).toHaveCount(0);await expect(trigger).toBeFocused();await expect(page.getByLabel('تعداد بزرگسال',{exact:true})).toHaveValue('1');await page.waitForTimeout(350);expect(requests).toHaveLength(1);
      await trigger.click();await page.getByLabel('تاریخ رفت میلادی در تقویم',{exact:true}).fill(next);await page.getByRole('button',{name:'اعمال تاریخ‌ها',exact:true}).click();await expect.poll(()=>requests.length).toBe(2);expect(requests[1]!.party).toEqual({adults:1,children:0,infants:0});record('calendar-history.json',{requests,provisionalOldPartyNotCommitted:true,focusReturned:true});
    }finally{await resetOwn(page);}
  });
  test('old real API observations under injected client clock skew stay unavailable with bounded explicit recovery',async({page})=>{
    test.setTimeout(60000);await page.clock.install({time:Date.now()+61000});let starts=0;let fail=false;const originals:unknown[]=[];
    await page.route('**/api/v1/date-prices',async route=>{if(route.request().method()==='POST'){starts++;if(fail){await route.abort('internetdisconnected');return;}}await route.continue();});page.on('response',async response=>{if(response.url().includes('/api/v1/date-prices')&&response.ok()){const snapshot=await response.json();if(snapshot.status==='complete')originals.push(snapshot);}});
    try{await page.goto('/');await expect(page.getByRole('alert').filter({hasText:'دیگر تازه نیستند'})).toBeVisible({timeout:12000});expect(starts).toBe(1);const before={url:page.url(),date:await page.locator('[data-selected-outbound]').getAttribute('data-selected-outbound')};await expect(page.getByRole('listbox',{name:'روزهای نزدیک'}).getByText(/تومان/)).toHaveCount(0);await page.clock.fastForward(61000);expect(starts).toBe(1);
      fail=true;await page.getByRole('button',{name:'تلاش دوباره برای قیمت روزها'}).click();await expect(page.getByRole('alert').filter({hasText:'دریافت نشد'})).toBeVisible();expect(starts).toBe(2);await page.clock.fastForward(61000);expect(starts).toBe(2);
      fail=false;await page.clock.setSystemTime(Date.now());await page.getByRole('button',{name:'تلاش دوباره برای قیمت روزها'}).click();await ready(page);expect(starts).toBe(3);await expect(page.getByRole('listbox',{name:'روزهای نزدیک'}).getByText(/تومان/).first()).toBeVisible();await page.clock.fastForward(60000);await expect(page.getByRole('alert').filter({hasText:'دیگر تازه نیستند'})).toBeVisible();expect(starts).toBe(3);expect(page.url()).toBe(before.url);await expect(page.locator('[data-selected-outbound]')).toHaveAttribute('data-selected-outbound',before.date!);record('stale-recovery.json',{fault:'Client clock deliberately +61s; API observations unmodified. Explicit second request deliberately aborted; third request real API recovery. Not provider failure evidence.',starts,originals,selectionPreserved:before});
    }finally{await page.clock.setSystemTime(Date.now());await resetOwn(page);}
  });
});
