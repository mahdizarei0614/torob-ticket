import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out=resolve(process.env.HOTEL_OVERLAY_EVIDENCE_DIR??'docs/evidence/adjustments/continuous-dot-motion/hotel-overlay');
test.use({video:process.env.HOTEL_OVERLAY_VIDEO==='1'?{mode:'on',size:{width:1366,height:768}}:'off'});
test('@hotel-overlay banner appearance and removal leave the map viewport fixed',async({page})=>{
  mkdirSync(out,{recursive:true});await page.setViewportSize({width:1366,height:768});
  await page.addInitScript(()=>localStorage.setItem('torobticket.appearance','dark'));
  expect((await page.request.post('/api/v1/demo/session',{data:{seed:3333,anchorInstant:'2026-10-25T06:00:00Z',scenario:'normal'}})).status()).toBe(201);
  const states:unknown[]=[];
  try {
    const query={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-10-29',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
    await page.goto('/?q='+encodeURIComponent(JSON.stringify(query)));
    const map=page.locator('aside[aria-label="نقشه سفر"]'),camera=map.locator('[data-camera]'),entry=page.locator('[data-hotel-entry]'),dock=page.locator('[data-map-hotel-dock]');
    await expect(entry).toBeVisible();await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status','ready');
    const baseline=await camera.boundingBox(),graphics=map.locator('[data-graphics-view]'),graphicsBaseline=await graphics.boundingBox();expect(baseline).not.toBeNull();
    const record=async(name:string)=>{const current=await camera.boundingBox(),track=await graphics.boundingBox();expect(current).toEqual(baseline);expect(track).toEqual(graphicsBaseline);states.push({name,viewport:current,graphics:track,banner:await entry.count(),dock:await dock.boundingBox(),map:await map.evaluate(node=>({clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,scrollTop:node.scrollTop}))});};
    expect(await dock.evaluate(node=>getComputedStyle(node).position)).toBe('absolute');await record('banner-visible');
    await page.getByRole('button',{name:'پاک کردن مقصد',exact:true}).click();await expect(entry).toHaveCount(0);await record('banner-removed');
    const destination=page.getByRole('combobox',{name:'مقصد',exact:true});await destination.fill('مشهد');await page.getByRole('option',{name:'مشهد',exact:true}).click();
    await expect(entry).toBeVisible();await record('banner-reappeared');
    await expect(page.getByRole('button',{name:'جست‌وجوی سفر',exact:true})).toBeEnabled();await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();
    await expect(page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true})).toHaveAttribute('data-status','complete',{timeout:20000});await expect(page.locator('article[data-selected="true"]')).toHaveCount(1);await expect(map).toHaveAttribute('data-map-itinerary',/.+/);await record('selected-result');
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await record('results-scrolled');
    const box=await dock.boundingBox();expect(box!.y+box!.height).toBe(744);expect(box!.x).toBe(24);
    if(process.env.HOTEL_OVERLAY_VIDEO==='1')await page.waitForTimeout(10000);
    await page.screenshot({path:resolve(out,'desktop-overlay.png')});
    await page.setViewportSize({width:390,height:844});await expect(map).toBeHidden();await expect(entry).toHaveAttribute('data-hotel-placement','inline');
    const mobile=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.viewport);
    writeFileSync(resolve(out,'viewport-invariance.json'),JSON.stringify({states,mobile},null,2));
  } finally {const response=await page.request.post('/api/v1/admin/reset',{data:{}});writeFileSync(resolve(out,'cleanup.json'),JSON.stringify({status:response.status()}));expect(response.status()).toBe(201);}
});
