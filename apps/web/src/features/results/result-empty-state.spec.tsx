import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { completedEmptyCoverage, ResultEmptyState } from './result-empty-state';
import { recovery } from './results-test-data';
import { query } from '../search/search-test-data';

function completed() {
 const snapshot=recovery([]).snapshot;
 snapshot.status='empty';
 snapshot.coverage={expectedProviderIds:['p','q'],successfulProviderIds:['p','q'],failedProviderIds:[],pendingProviderIds:[],complete:true};
 return snapshot;
}
describe('compact result empty states',()=>{
 it('shows a deliberate no-match only for completed successful coverage and leaves adjustment to the traveler',()=>{
  const date=vi.fn(),edit=vi.fn(),fresh=vi.fn();
  const view=render(<ResultEmptyState snapshot={completed()} query={query} onEdit={edit} onDate={date} onFresh={fresh}/>);
  expect(screen.getByRole('heading',{name:'برای این سفر پیشنهادی پیدا نشد'})).toBeVisible();
  expect(view.container.querySelector('[data-results-empty]')).toHaveAttribute('data-results-empty','no-match');
  expect(screen.getByText(/در پاسخ فروشندگان برای این مسیر و تاریخ/)).toBeVisible();
  expect(screen.queryByRole('button',{name:'تلاش دوباره'})).not.toBeInTheDocument();expect(date).not.toHaveBeenCalled();expect(edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'بررسی تاریخ دیگر'}));expect(date).toHaveBeenCalledOnce();expect(fresh).not.toHaveBeenCalled();
 });
 it('distinguishes a filter-empty comparison and removes only the chosen active filter',()=>{
  const clear=vi.fn(),fresh=vi.fn();
  render(<ResultEmptyState snapshot={completed()} query={{...query,filters:{budgetMaxRial:100,refundableOnly:true}}} onEdit={vi.fn()} onFresh={fresh} onClearFilter={clear}/>);
  expect(screen.getByRole('heading',{name:'پیشنهادی با این فیلترها پیدا نشد'})).toBeVisible();
  expect(screen.getByRole('region',{name:'وضعیت پیشنهادهای سفر'})).toHaveAttribute('data-results-empty','filter-empty');
  fireEvent.click(screen.getByRole('button',{name:'حذف سقف قیمت'}));expect(clear).toHaveBeenCalledExactlyOnceWith('budgetMaxRial');expect(fresh).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'حذف بار تحویلی'})).not.toBeInTheDocument();
 });
 it.each(['failed','interrupted','partial','cancelled'] as const)('never calls a %s collection a no-match',status=>{
  const snapshot=completed();snapshot.status=status;snapshot.coverage.failedProviderIds=['q'];snapshot.coverage.successfulProviderIds=['p'];
  const fresh=vi.fn();render(<ResultEmptyState snapshot={snapshot} query={query} onEdit={vi.fn()} onFresh={fresh}/>);
  expect(screen.getByRole('region',{name:'وضعیت پیشنهادهای سفر'})).toHaveAttribute('data-results-empty','unavailable');
  expect(screen.getByText(/هنوز نمی‌توان موجودی این سفر را مشخص کرد/)).toBeVisible();expect(screen.queryByText(/پیدا نشد/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'تلاش دوباره'}));expect(fresh).toHaveBeenCalledOnce();
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
 it('keeps a failed connection distinct even if an empty snapshot carried completed coverage',()=>{
  render(<ResultEmptyState snapshot={completed()} query={query} unavailable onEdit={vi.fn()}/>);
  expect(screen.getByRole('heading',{name:'پاسخ فروشندگان کامل دریافت نشد'})).toBeVisible();
  expect(screen.queryByText('برای این سفر پیشنهادی پیدا نشد')).not.toBeInTheDocument();
 });
});
