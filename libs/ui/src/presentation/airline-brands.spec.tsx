import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {airlineBrands,resolveAirlineBrand} from './airline-brands';
import {displayOperatorName} from './travel-labels';
import {ProviderMark} from '../icons/provider-mark';

afterEach(cleanup);

describe('airline identity at the presentation boundary',()=>{
 it.each([
  ['demo-operator-flight-0','iran-air','ایران‌ایر'],
  ['demo-operator-flight-1','mahan-air','ماهان'],
  ['demo-operator-flight-2','iran-aseman','آسمان'],
 ])('pairs %s with its own name and local logo',(operatorId,id,name)=>{
  expect(displayOperatorName(operatorId,'flight')).toBe(name);
  const view=render(<ProviderMark operatorId={operatorId} mode="flight" label={name} size={40}/>);
  const mark=screen.getByRole('img',{name});
  expect(mark).toHaveAttribute('data-airline-brand',id);
  expect(mark).toHaveAttribute('src',`/airlines/${id}-64.png`);
  expect(mark).toHaveAttribute('srcset',`/airlines/${id}-64.png 1x, /airlines/${id}-128.png 2x`);
  expect(mark).toHaveAttribute('width','40');
  expect(view.container.querySelector('svg')).toBeNull();
 });

 it('uses only exact configured flight aliases and never derives a brand from a provider or partial code',()=>{
  const aliases=airlineBrands.flatMap(brand=>brand.aliases);
  expect(new Set(aliases).size).toBe(aliases.length);
  for(const brand of airlineBrands)for(const alias of brand.aliases){
   expect(resolveAirlineBrand(alias,'flight')).toBe(brand);
   expect(displayOperatorName(alias,'flight')).toBe(brand.nameFa);
   expect(resolveAirlineBrand(alias,'train')).toBeUndefined();
   expect(resolveAirlineBrand(alias,'bus')).toBeUndefined();
  }
  for(const id of ['IR','IRA','iata:ir','demo-operator-flight-0-extra','demo-operator-flight-3','other-airline:iran-air','__proto__',''])expect(resolveAirlineBrand(id,'flight')).toBeUndefined();
  const view=render(<><ProviderMark operatorId="demo-operator-flight-0" mode="train"/><ProviderMark providerId="demo-provider-01" operatorId="demo-operator-flight-0" mode="flight"/><ProviderMark operatorId="new-airline" mode="flight"/></>);
  expect(view.container.querySelectorAll('[data-provider-mark="unknown"]')).toHaveLength(3);
  expect(view.container.querySelector('img')).toBeNull();
 });

 it('keeps a decorative local logo out of the accessibility tree and preserves safe supplied text',()=>{
  const view=render(<><ProviderMark operatorId="iata:IR" mode="flight"/><ProviderMark operatorId="iata:W5" mode="flight" label={'ماهان <script>alert(1)</script>'}/></>);
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByRole('img',{name:'ماهان <script>alert(1)</script>'})).toBeInTheDocument();
  expect(view.container.querySelector('[data-airline-brand="iran-air"]')).toHaveAttribute('aria-hidden','true');
  expect(view.container.querySelector('script')).toBeNull();
 });

 it('falls back neutrally when a local image fails, then loads a newly supplied identity',()=>{
  const view=render(<ProviderMark operatorId="demo-operator-flight-0" mode="flight" label="ایران‌ایر"/>);
  fireEvent.error(screen.getByRole('img',{name:'ایران‌ایر'}));
  expect(view.container.querySelector('img')).toBeNull();
  expect(screen.getByRole('img',{name:'ایران‌ایر'})).toHaveAttribute('data-provider-mark','unknown');
  view.rerender(<ProviderMark operatorId="demo-operator-flight-1" mode="flight" label="ماهان"/>);
  expect(screen.getByRole('img',{name:'ماهان'})).toHaveAttribute('data-airline-brand','mahan-air');
 });
});
