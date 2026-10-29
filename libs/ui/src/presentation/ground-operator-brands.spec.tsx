import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {groundOperatorBrands,resolveGroundOperatorBrand} from './ground-operator-brands';
import {displayOperatorName} from './travel-labels';
import {ProviderMark} from '../icons/provider-mark';

afterEach(cleanup);

describe('ground operator identity at the presentation boundary',()=>{
 it.each([
  ['rail:raja','train','raja','رجا'],
  ['rail:fadak','train','fadak','فدک'],
  ['rail:bonrail','train','bonrail','بن ریل'],
  ['bus:iran-peyma','bus','iran-peyma','ایران پیما'],
  ['bus:hamsafar','bus','hamsafar','همسفر'],
  ['bus:royal-safar','bus','royal-safar','رویال سفر'],
 ] as const)('pairs %s with its own name and local logo',(operatorId,mode,id,name)=>{
  expect(displayOperatorName(operatorId,mode)).toBe(name);
  const view=render(<ProviderMark operatorId={operatorId} mode={mode} label={name} size={40}/>);
  const mark=screen.getByRole('img',{name});
  expect(mark).toHaveAttribute('data-ground-operator-brand',id);
  expect(mark).toHaveAttribute('src',`/ground-operators/${id}-64.png`);
  expect(mark).toHaveAttribute('srcset',`/ground-operators/${id}-64.png 1x, /ground-operators/${id}-128.png 2x`);
  expect(mark).toHaveAttribute('width','40');
  expect(mark).not.toHaveAttribute('data-airline-brand');
  expect(view.container.querySelector('svg')).toBeNull();
 });

 it('resolves exact mode-specific operating identities and keeps marketplaces separate',()=>{
  const aliases=groundOperatorBrands.flatMap(brand=>brand.aliases);
  expect(new Set(aliases).size).toBe(aliases.length);
  for(const brand of groundOperatorBrands)for(const alias of brand.aliases){
   expect(resolveGroundOperatorBrand(alias,brand.mode)).toBe(brand);
   expect(displayOperatorName(alias,brand.mode)).toBe(brand.nameFa);
   expect(resolveGroundOperatorBrand(alias,'flight')).toBeUndefined();
   expect(resolveGroundOperatorBrand(alias,brand.mode==='train'?'bus':'train')).toBeUndefined();
  }
  for(const id of ['raja','1','providerCode:1','rail:raja-extra','bus:raja','train:raja','__proto__',''])expect(resolveGroundOperatorBrand(id,'train')).toBeUndefined();
  const view=render(<><ProviderMark providerId="demo-provider-01" operatorId="rail:raja" mode="train"/><ProviderMark operatorId="rail:raja" mode="bus"/><ProviderMark providerId="bus:hamsafar" mode="bus"/></>);
  expect(view.container.querySelectorAll('[data-provider-mark="unknown"]')).toHaveLength(3);
  expect(view.container.querySelector('img')).toBeNull();
 });

 it('retains existing ground fixture names and neutral unknown fallback',()=>{
  expect(displayOperatorName('demo-operator-train-0','train')).toBe('قطار آبان');
  expect(displayOperatorName('demo-operator-bus-0','bus')).toBe('راه‌پیما');
  expect(displayOperatorName('rail:unknown','train')).toBe('شرکت حمل‌ونقل');
  const view=render(<><ProviderMark operatorId="demo-operator-train-0" mode="train"/><ProviderMark operatorId="rail:unknown" mode="train"/><ProviderMark providerId="demo-provider-01"/></>);
  expect(view.container.querySelector('[data-provider-mark="operator-train-0"]')).toBeInTheDocument();
  expect(view.container.querySelector('[data-provider-mark="unknown"]')).toBeInTheDocument();
  expect(view.container.querySelector('[data-provider-mark="provider-1"]')).toBeInTheDocument();
  expect(view.container.querySelector('img')).toBeNull();
 });

 it('keeps decorative marks hidden and escapes a supplied accessible label',()=>{
  const view=render(<><ProviderMark operatorId="rail:fadak" mode="train"/><ProviderMark operatorId="bus:hamsafar" mode="bus" label={'همسفر <script>alert(1)</script>'}/></>);
  expect(view.container.querySelector('[data-ground-operator-brand="fadak"]')).toHaveAttribute('aria-hidden','true');
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByRole('img',{name:'همسفر <script>alert(1)</script>'})).toBeInTheDocument();
  expect(view.container.querySelector('script')).toBeNull();
 });

 it('falls back neutrally on image failure and loads another ground or airline identity',()=>{
  const view=render(<ProviderMark operatorId="rail:fadak" mode="train" label="فدک"/>);
  fireEvent.error(screen.getByRole('img',{name:'فدک'}));
  expect(screen.getByRole('img',{name:'فدک'})).toHaveAttribute('data-provider-mark','unknown');
  expect(view.container.querySelector('img')).toBeNull();
  view.rerender(<ProviderMark operatorId="bus:hamsafar" mode="bus" label="همسفر"/>);
  expect(screen.getByRole('img',{name:'همسفر'})).toHaveAttribute('data-ground-operator-brand','hamsafar');
  view.rerender(<ProviderMark operatorId="airline:turkish-airlines" mode="flight" label="ترکیش ایرلاینز"/>);
  expect(screen.getByRole('img',{name:'ترکیش ایرلاینز'})).toHaveAttribute('data-airline-brand','turkish-airlines');
 });
});
