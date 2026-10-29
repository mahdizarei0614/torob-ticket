import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { DateWheel } from './date-wheel';
import { dateLabel } from './date-state';
const dates = ['2026-10-25','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30'];
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('compact wheel previews and authorized settle', () => {
  it('names every row with its full date and actual price or availability, including states that can be visually shortened', () => {
    const coverage = { complete: true, expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [] };
    const allDates = [...dates, '2026-10-31'];
    const cells: DatePriceCell[] = [
      { date: dates[0]!, status: 'priced', minimum: { amountRial: 10001, currency: 'IRR' }, coverage, observedAt: '2026-10-25T00:00:00Z', quoteIds: ['q'], offerIds: ['o'] },
      { date: dates[1]!, status: 'checking' },
      { date: dates[2]!, status: 'no-match', coverage },
      { date: dates[3]!, status: 'unavailable', reason: 'incomplete-price', retryable: false, coverage },
      { date: dates[4]!, status: 'outside-coverage' },
      { date: dates[5]!, status: 'invalid-date-pair', reason: 'return-before-departure' },
    ];
    render(<DateWheel dates={allDates} value={dates[0]!} cells={cells} range={{ min: 0, max: 100000 }} onPreview={vi.fn()} onCommit={vi.fn()} leg="return" />);
    const labels = ['۱٬۰۰۰٫۱ تومان', 'در حال بررسی', 'پیشنهاد مطابق نیست', 'قیمت کامل مشخص نیست', 'خارج از پوشش', 'پیش از تاریخ رفت', 'هنوز بررسی نشده'];
    const rows = labels.map((availability, index) => screen.getByRole('option', { name: `${dateLabel(allDates[index]!)}، ${availability}` }));
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    expect(within(rows[0]!).getByText('۱٬۰۰۰٫۱ تومان')).toHaveAttribute('data-price-band', 'low');
    expect(within(rows[0]!).getByText(dateLabel(dates[0]!))).toHaveAttribute('dir', 'ltr');
    expect(within(rows[0]!).getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(rows[2]).not.toHaveAttribute('aria-disabled');
    expect(rows[4]).toHaveAttribute('aria-disabled', 'true'); expect(rows[5]).toHaveAttribute('aria-disabled', 'true');
    rows.slice(1).forEach(row => expect(row.querySelector('small')).toHaveAttribute('data-price-band', 'unknown'));
  });
  it('retains truthful leg-aware and missing-price labels while updating a row in place', () => {
    const props = { dates, value: dates[0]!, onPreview: vi.fn(), onCommit: vi.fn() };
    const cells: DatePriceCell[] = [{ date: dates[0]!, status: 'invalid-date-pair', reason: 'return-before-departure' }];
    const view = render(<DateWheel {...props} cells={cells} leg="outbound" />);
    const selected = screen.getByRole('option', { name: `${dateLabel(dates[0]!)}، برگشت را دوباره انتخاب کنید` });
    expect(selected).not.toHaveAttribute('aria-disabled');
    view.rerender(<DateWheel {...props} cells={[]} missingLabel="قیمت در دسترس نیست" />);
    expect(screen.getByRole('option', { name: `${dateLabel(dates[0]!)}، قیمت در دسترس نیست` })).toBe(selected);
    expect(selected).not.toHaveAccessibleName(/۰ تومان|پیشنهاد مطابق نیست/);
  });
  it('previews drag frames, commits once after release at 250ms, and restores committed selection on pointer cancel', () => {
    vi.stubGlobal('PointerEvent', MouseEvent); vi.useFakeTimers(); const preview = vi.fn(), commit = vi.fn();
    render(<DateWheel dates={dates} value={dates[2]!} cells={[]} onPreview={preview} onCommit={commit} />);
    const wheel = screen.getByRole('listbox', { name: 'روزهای نزدیک' });
    fireEvent.pointerDown(wheel, { pointerId: 1, clientY: 180 });
    fireEvent.pointerMove(wheel, { pointerId: 1, clientY: 125 });
    expect(preview).toHaveBeenLastCalledWith(dates[3]); expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerUp(wheel, { pointerId: 1, clientY: 125 });
    act(() => vi.advanceTimersByTime(249)); expect(commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); expect(commit).toHaveBeenCalledExactlyOnceWith(dates[3]);
    fireEvent.pointerDown(wheel, { pointerId: 2, clientY: 180 }); fireEvent.pointerMove(wheel, { pointerId: 2, clientY: 80 }); fireEvent.pointerCancel(wheel, { pointerId: 2 });
    act(() => vi.advanceTimersByTime(300)); expect(commit).toHaveBeenCalledTimes(1); expect(preview).toHaveBeenLastCalledWith(dates[2]);
  });
  it('supports keyboard and wheel dates, chaining native scroll at a boundary', () => {
    vi.stubGlobal('PointerEvent', MouseEvent); vi.useFakeTimers(); const commit = vi.fn();
    render(<DateWheel dates={dates} value={dates[2]!} cells={[]} onPreview={() => undefined} onCommit={commit} />);
    const wheel = screen.getByRole('listbox', { name: 'روزهای نزدیک' });
    fireEvent.keyDown(wheel, { key: 'ArrowDown' }); act(() => vi.advanceTimersByTime(250)); expect(commit).toHaveBeenLastCalledWith(dates[3]);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 54 }); act(() => wheel.dispatchEvent(event)); expect(event.defaultPrevented).toBe(true); act(() => vi.advanceTimersByTime(250)); expect(commit).toHaveBeenLastCalledWith(dates[4]);
    fireEvent.keyDown(wheel, { key: 'End' }); act(() => vi.advanceTimersByTime(250)); const edge = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 }); wheel.dispatchEvent(edge); expect(edge.defaultPrevented).toBe(false);
    const zoom = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, ctrlKey: true }); wheel.dispatchEvent(zoom); expect(zoom.defaultPrevented).toBe(false);
  });
});
