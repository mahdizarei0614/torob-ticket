import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultsList } from './results-page';
import { useResults } from './use-results';
import { createResultsState, resultsReducer } from './results-reducer';
import { group, observedAt, recovery } from './results-test-data';
import { catalog, query } from '../search/search-test-data';
vi.mock('./use-results', () => ({ useResults: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
function expired(connectionState: 'settled' | 'expired' | 'unavailable' = 'settled') {
  const now = Date.parse(observedAt) + 11 * 60000; vi.spyOn(Date, 'now').mockReturnValue(now);
  const groups = [group('past'), group('also-past', 12000000)], value = recovery(groups);
  value.snapshot.status = 'complete'; value.snapshot.coverage = { complete: true, expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [] };
  let state = resultsReducer(createResultsState('generation', 'search'), { type: 'receive', recovery: value });
  state = resultsReducer(state, { type: 'select', selection: { groupId: 'past', quoteId: 'past-quote', version: 1 }, now: Date.parse(observedAt) + 1000 });
  const read = vi.fn(), fresh = vi.fn(), resume = vi.fn(), edit = vi.fn(), date = vi.fn(), select = vi.fn(), seller = vi.fn(() => <button>فروشنده این قیمت</button>), dispatch = vi.fn();
  vi.mocked(useResults).mockReturnValue({ state, dispatch, now, stored: value, connectionState, connectionError: connectionState === 'unavailable', error: connectionState === 'unavailable' ? Error('offline') : undefined, retryRead: read });
  const view = render(<ResultsList isCurrent={() => true} generation="generation" searchId="search" query={query} catalog={catalog} allowDefaultSelection={false} refinementDisabled={false} draftChanged={false} onRefine={vi.fn()} onEdit={edit} onFreshSearch={fresh} onResume={resume} onEditDate={date} onSelectQuote={select} renderProviderAction={seller} />);
  return { ...view, read, fresh, resume, edit, date, select, seller, dispatch };
}
describe('quiet expired quote presentation', () => {
  it('removes only the routine recovery card/actions while retaining expired-card indicators and blocked selection/sellers', () => {
    const view = expired();
    expect(screen.queryByRole('region', { name: 'بازیابی مقایسه سفر' })).not.toBeInTheDocument();
    expect(screen.queryByText('مهلت قیمت‌های این مقایسه پایان یافته است')).not.toBeInTheDocument();
    for (const name of ['مقایسه تازه با شرایط فرم','بررسی تاریخ دیگر','ویرایش شرایط سفر']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    const cards = screen.getAllByRole('article'); expect(cards).toHaveLength(2);
    cards.forEach(card => { const button = within(card).getByRole('button', { name: 'انتخاب پیشنهاد' }); expect(button).toBeDisabled(); fireEvent.click(button); expect(card.querySelector('[data-invalid-price]')).toHaveAttribute('data-invalid-price', 'expired'); });
    expect(screen.queryByRole('button', { name: 'فروشنده این قیمت' })).not.toBeInTheDocument(); expect(view.seller).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'select' })); expect(view.fresh).not.toHaveBeenCalled(); expect(view.read).not.toHaveBeenCalled();
  });
  it('retains real session expiry recovery even when all quotes are also expired', () => {
    const view = expired('expired');
    expect(screen.getByRole('heading', { name: 'برای ادامه نشست را بازیابی کنید' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'بازیابی نشست و حفظ فرم' })); expect(view.resume).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'مقایسه تازه با شرایط فرم' })).not.toBeInTheDocument();
  });
  it('retains actual network recovery without relabeling the error as ordinary quote expiry', () => {
    const view = expired('unavailable');
    expect(screen.getByRole('region', { name: 'بازیابی مقایسه سفر' })).toBeVisible();
    expect(screen.queryByText('مهلت قیمت‌های این مقایسه پایان یافته است')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'خواندن دوباره وضعیت' })); expect(view.read).toHaveBeenCalledOnce(); expect(view.fresh).not.toHaveBeenCalled();
  });
});
