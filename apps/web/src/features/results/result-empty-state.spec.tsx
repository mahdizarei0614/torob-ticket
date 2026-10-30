import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completedEmptyCoverage, ResultEmptyState } from './result-empty-state';
import { recovery } from './results-test-data';
import { query } from '../search/search-test-data';

// Exercise finite text entrances explicitly, independent of other suites' media stubs.
beforeEach(()=>vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

function completed() {
 const snapshot=recovery([]).snapshot;
 snapshot.status='empty';
 snapshot.coverage={expectedProviderIds:['p','q'],successfulProviderIds:['p','q'],failedProviderIds:[],pendingProviderIds:[],complete:true};
 return snapshot;
}
describe('compact result empty states',()=>{
 it('shows a deliberate no-match only for completed successful coverage and leaves adjustment to the traveler',async()=>{
  const date=vi.fn(),edit=vi.fn(),fresh=vi.fn();
  const view=render(<ResultEmptyState snapshot={completed()} query={query} onEdit={edit} onDate={date} onFresh={fresh}/>);
  const heading=screen.getByRole('heading',{name:'برای این سفر پیشنهادی پیدا نشد'}),description=screen.getByRole('status');
  expect(heading).toBeInTheDocument();expect(description).toHaveTextContent(/در پاسخ فروشندگان برای این مسیر و تاریخ/);
  expect(view.container.querySelector('[data-results-empty]')).toHaveAttribute('data-results-empty','no-match');
  expect(screen.queryByRole('button',{name:'تلاش دوباره'})).not.toBeInTheDocument();expect(date).not.toHaveBeenCalled();expect(edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'بررسی تاریخ دیگر'}));expect(date).toHaveBeenCalledOnce();expect(fresh).not.toHaveBeenCalled();
  await waitFor(()=>{expect(within(heading).getByText('برای این سفر پیشنهادی پیدا نشد')).toBeVisible();expect(within(description).getByText(/در پاسخ فروشندگان برای این مسیر و تاریخ/)).toBeVisible();});
 });
 it('distinguishes a filter-empty comparison and removes only the chosen active filter',async()=>{
  const clear=vi.fn(),fresh=vi.fn();
  render(<ResultEmptyState snapshot={completed()} query={{...query,filters:{budgetMaxRial:100,refundableOnly:true}}} onEdit={vi.fn()} onFresh={fresh} onClearFilter={clear}/>);
  const heading=screen.getByRole('heading',{name:'پیشنهادی با این فیلترها پیدا نشد'});expect(heading).toBeInTheDocument();
  expect(screen.getByRole('region',{name:'وضعیت پیشنهادهای سفر'})).toHaveAttribute('data-results-empty','filter-empty');
  fireEvent.click(screen.getByRole('button',{name:'حذف سقف قیمت'}));expect(clear).toHaveBeenCalledExactlyOnceWith('budgetMaxRial');expect(fresh).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'حذف بار تحویلی'})).not.toBeInTheDocument();
  await waitFor(()=>expect(within(heading).getByText('پیشنهادی با این فیلترها پیدا نشد')).toBeVisible());
 });
 it.each(['failed','interrupted','partial','cancelled'] as const)('never calls a %s collection a no-match',async status=>{
  const snapshot=completed();snapshot.status=status;snapshot.coverage.failedProviderIds=['q'];snapshot.coverage.successfulProviderIds=['p'];
  const fresh=vi.fn();render(<ResultEmptyState snapshot={snapshot} query={query} onEdit={vi.fn()} onFresh={fresh}/>);
  expect(screen.getByRole('region',{name:'وضعیت پیشنهادهای سفر'})).toHaveAttribute('data-results-empty','unavailable');
  const description=screen.getByRole('status');expect(description).toHaveTextContent(/هنوز نمی‌توان موجودی این سفر را مشخص کرد/);expect(screen.queryByText(/پیدا نشد/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'تلاش دوباره'}));expect(fresh).toHaveBeenCalledOnce();
  await waitFor(()=>expect(within(description).getByText(/هنوز نمی‌توان موجودی این سفر را مشخص کرد/)).toBeVisible());
 });
 it.each([
  {complete:false},
  {expectedProviderIds:[]},
  {failedProviderIds:['q']},
  {pendingProviderIds:['q']},
  {successfulProviderIds:['p']},
 ])('requires full positive coverage evidence even when the status says empty: %j',coverage=>{
  const snapshot=completed();snapshot.coverage={...snapshot.coverage,...coverage};
  expect(completedEmptyCoverage(snapshot)).toBe(false);
 });
 it('keeps a failed connection distinct even if an empty snapshot carried completed coverage',async()=>{
  render(<ResultEmptyState snapshot={completed()} query={query} unavailable onEdit={vi.fn()}/>);
  const heading=screen.getByRole('heading',{name:'پاسخ فروشندگان کامل دریافت نشد'});expect(heading).toBeInTheDocument();
  expect(screen.queryByText('برای این سفر پیشنهادی پیدا نشد')).not.toBeInTheDocument();
  await waitFor(()=>expect(within(heading).getByText('پاسخ فروشندگان کامل دریافت نشد')).toBeVisible());
 });
});
