import {fireEvent,render,screen} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {JourneyCard} from './journey-card';
import {createResultsState,resultsReducer} from './results-reducer';
import {group,observedAt,recovery} from './results-test-data';
import {catalog} from '../search/search-test-data';
afterEach(()=>vi.restoreAllMocks());
it('retained historical cards expose readable facts but disable both representative and provider selections',()=>{vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const g=group('historical'),saved=recovery([g]);const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:saved});const select=vi.fn();render(<JourneyCard selectionDisabled group={g} snapshot={saved.snapshot} catalog={catalog} state={state} now={Date.now()} onFreeze={()=>undefined} onSelect={select}/>);expect(screen.getByRole('button',{name:'انتخاب پیشنهاد'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'جزئیات سفر'}));expect(screen.queryByRole('button',{name:'انتخاب این پیشنهاد'})).not.toBeInTheDocument();expect(screen.getByText('بار همراه: نامشخص')).toBeVisible();expect(select).not.toHaveBeenCalled();});

it.each([{changed:true,expired:false,reason:'changed-intent'},{changed:false,expired:true,reason:'expired'}])('shows concise invalid price for $reason without exposing a seller action',({changed,expired,reason})=>{
 const g=group('invalid'),saved=recovery([g]);let state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:saved});
 state=resultsReducer(state,{type:'select',selection:{groupId:g.groupId,quoteId:g.eligibleQuotes[0]!.quoteId,version:1},now:Date.parse(observedAt)+1000});
 const select=vi.fn(),pin=vi.fn();const now=Date.parse(expired?g.eligibleQuotes[0]!.expiresAt:observedAt)+1000;
 const view=render(<JourneyCard draftChanged={changed} group={g} snapshot={saved.snapshot} catalog={catalog} state={state} now={now} onFreeze={()=>undefined} onSelect={select} onPinItinerary={pin} renderProviderAction={()=><a href="#seller">فروشنده</a>}/>);
 const indicator=view.container.querySelector('[data-invalid-price]')!;
 expect(indicator).toHaveAttribute('data-invalid-price',reason);expect(indicator.firstChild?.textContent).toBe('اعتبار قیمت پایان یافته');
 expect(indicator).toHaveAttribute('title',expired?'مهلت زمانی این قیمت پایان یافته است.':'این قیمت برای شرایط قبلی سفر است.');
 const choice=screen.getByRole('button',{name:'انتخاب پیشنهاد'});expect(choice).toBeDisabled();fireEvent.click(choice);expect(select).not.toHaveBeenCalled();expect(pin).not.toHaveBeenCalled();
 expect(screen.queryByRole('link',{name:'فروشنده'})).not.toBeInTheDocument();expect(view.container.querySelector('[data-price-band]')).toHaveAttribute('data-price-band','unknown');
});
it.each(['unavailable','changed'] as const)('retains genuine %s evidence invalidation when the form also changes',status=>{
 const g=group('invalidated'),saved=recovery([g]);let state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:saved});
 state=resultsReducer(state,{type:'freeze'});
 const latest=structuredClone(saved);latest.sequence=2;
 if(status==='unavailable')latest.snapshot.groups=[];else latest.snapshot.groups[0]!.eligibleQuotes[0]!.total.amountRial+=100;
 state=resultsReducer(state,{type:'receive',recovery:latest});
 const view=render(<JourneyCard draftChanged group={g} snapshot={saved.snapshot} catalog={catalog} state={state} now={Date.parse(observedAt)+1000} onFreeze={()=>undefined} onSelect={()=>undefined}/>);
 expect(view.container.querySelector('[data-invalid-price]')).toHaveAttribute('data-invalid-price',status);
 expect(view.container.querySelector('[data-invalid-price]')).toHaveAttribute('title','این نسخه از پیشنهاد دیگر معتبر نیست.');
 fireEvent.click(screen.getByRole('button',{name:'جزئیات سفر'}));
 expect(screen.getByText('این نسخه دیگر معتبر نیست؛ نتایج تازه را اعمال کنید.')).toBeVisible();
 expect(screen.queryByText('این قیمت برای شرایط قبلی سفر است.')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'انتخاب پیشنهاد'})).toBeDisabled();
});
it('a current card remains selectable with the same factual price and version',()=>{vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);const g=group('current'),saved=recovery([g]);const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:saved});render(<JourneyCard group={g} snapshot={saved.snapshot} catalog={catalog} state={state} now={Date.now()} onFreeze={()=>undefined} onSelect={()=>undefined}/>);expect(screen.getByRole('button',{name:'انتخاب پیشنهاد'})).toBeEnabled();expect(screen.getByRole('article')).toHaveAttribute('data-quote-version',String(g.eligibleQuotes[0]!.version));});
