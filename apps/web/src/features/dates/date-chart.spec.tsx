import { useState, type ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { MotionPolicyProvider, priceChartX } from '@torob-ticket/ui';
import { DateChart } from './date-chart';
import { dateLabel } from './date-state';

vi.mock('@torob-ticket/graphics/host', () => ({ GraphicsView: ({ fallback }: { fallback: ReactNode }) => <div>{fallback}</div> }));
const coverage = { expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [], complete: true };
const priced = (date: string, amountRial: number): DatePriceCell => ({ date, status: 'priced', minimum: { amountRial, currency: 'IRR' }, coverage, observedAt: '2026-10-25T00:00:00Z', quoteIds: ['q'], offerIds: ['o'] });
const cells: DatePriceCell[] = [priced('2026-10-25', 1000), { date: '2026-10-26', status: 'outside-coverage' }, { date: '2026-10-27', status: 'no-match', coverage }, priced('2026-10-28', 2500), { date: '2026-10-29', status: 'checking' }];
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerType: string; pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerType = init.pointerType ?? 'mouse'; this.pointerId = init.pointerId ?? 1; }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function mountChart(covered = false) {
  const select = vi.fn();
  function Chart({ covered }: { covered: boolean }) {
    const [selected, setSelected] = useState(cells[0]!.date);
    return <MotionPolicyProvider covered={covered}><DateChart cells={cells} selected={selected} onSelect={date => { select(date); setSelected(date); }} leg="outbound" /></MotionPolicyProvider>;
  }
  const view = render(<Chart covered={covered} />), slider = screen.getByRole('slider');
  vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 184 } as DOMRect);
  const position = (index: number, pointerType = 'mouse') => ({ pointerId: 1, pointerType, button: 0, clientX: (priceChartX(cells, index) + 1) / 2 * 300, clientY: 90 });
  return { ...view, slider, select, position, rerenderCovered: (value: boolean) => view.rerender(<Chart covered={value} />) };
}

describe('exact date chart inspection and selection', () => {
  it('shows a custom exact-cell tooltip on hover while retaining the selected ring on another date', () => {
    const view = mountChart();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByText('کمترین قیمت:')).toBeInTheDocument(); expect(screen.getByText('بیشترین قیمت:')).toBeInTheDocument();
    expect(screen.queryByText('کمینه:')).not.toBeInTheDocument(); expect(screen.queryByText('بیشینه:')).not.toBeInTheDocument();
    fireEvent.pointerMove(view.slider, view.position(3));
    const tooltip = screen.getByRole('tooltip');
    expect(within(tooltip).getByText(dateLabel(cells[3]!.date))).toBeInTheDocument();
    expect(within(tooltip).getByText('۲۵۰')).toBeInTheDocument(); expect(within(tooltip).getByText('تومان')).toBeInTheDocument();
    expect(view.slider).toHaveAttribute('aria-describedby', tooltip.id);
    expect(view.container.querySelector('[data-price-marker="2026-10-25"]')).toHaveAttribute('data-selected', 'true');
    expect(view.container.querySelector('[data-price-marker="2026-10-28"]')).toHaveAttribute('data-hovered', 'true');
    expect(view.select).not.toHaveBeenCalled();
    fireEvent.pointerMove(view.slider, view.position(2));
    expect(screen.getByRole('tooltip')).toHaveTextContent('پیشنهاد مطابق نیست');
    expect(view.container.querySelector('[data-price-marker="2026-10-27"]')).toBeNull();
    fireEvent.pointerLeave(view.slider, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('keeps LTR date coordinates under RTL, skips structurally disabled days and permits no-match dates by keyboard', () => {
    const view = mountChart();
    act(() => view.slider.focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('۱۰۰');
    fireEvent.keyDown(view.slider, { key: 'ArrowRight' });
    expect(view.select).toHaveBeenLastCalledWith('2026-10-27');
    expect(view.slider).toHaveAttribute('aria-valuenow', '2'); expect(view.slider).toHaveAttribute('aria-valuetext', expect.stringContaining('پیشنهاد مطابق نیست'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('پیشنهاد مطابق نیست');
    expect(view.container.querySelector('[data-chart-selection="2026-10-27"]')).toBeInTheDocument();
    expect(view.container.querySelector('[data-price-marker="2026-10-27"]')).toBeNull();
    fireEvent.keyDown(view.slider, { key: 'ArrowRight' }); expect(view.select).toHaveBeenLastCalledWith('2026-10-28');
    fireEvent.keyDown(view.slider, { key: 'Home' }); expect(view.select).toHaveBeenLastCalledWith('2026-10-25');
    fireEvent.keyDown(view.slider, { key: 'End' }); expect(view.select).toHaveBeenLastCalledWith('2026-10-29');
    expect(screen.getByRole('tooltip')).toHaveTextContent('در حال بررسی');
    expect(view.slider).toHaveFocus();
    fireEvent.keyDown(view.slider, { key: 'Escape' }); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('commits one touch tap, keeps its tooltip available, dismisses outside and does not commit a scroll or cancellation', () => {
    const view = mountChart();
    fireEvent.pointerDown(view.slider, view.position(3, 'touch')); fireEvent.pointerUp(view.slider, view.position(3, 'touch'));
    expect(view.select).toHaveBeenCalledExactlyOnceWith('2026-10-28');
    fireEvent.pointerLeave(view.slider, { pointerType: 'touch' }); expect(screen.getByRole('tooltip')).toHaveTextContent('۲۵۰');
    fireEvent.pointerDown(document.body, { pointerType: 'touch' }); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.pointerDown(view.slider, view.position(0, 'touch'));
    fireEvent.pointerMove(view.slider, { ...view.position(0, 'touch'), clientY: 130 });
    fireEvent.pointerUp(view.slider, { ...view.position(0, 'touch'), clientY: 130 });
    expect(view.select).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(view.slider, view.position(0, 'touch')); fireEvent.pointerCancel(view.slider, view.position(0, 'touch'));
    expect(view.select).toHaveBeenCalledTimes(1); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it.each([[1, 2], [2, 1]])('cancels overlapping touches regardless of release order %j, then accepts a new single tap', (...order) => {
    const view = mountChart(), first = { ...view.position(0, 'touch'), pointerId: 1 }, second = { ...view.position(3, 'touch'), pointerId: 2 };
    fireEvent.pointerDown(view.slider, first); fireEvent.pointerDown(view.slider, second);
    for (const id of order) fireEvent.pointerUp(view.slider, id === 1 ? first : second);
    expect(view.select).not.toHaveBeenCalled(); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    const fresh = { ...view.position(3, 'touch'), pointerId: 3 };
    fireEvent.pointerDown(view.slider, fresh); fireEvent.pointerUp(view.slider, fresh);
    expect(view.select).toHaveBeenCalledExactlyOnceWith('2026-10-28');
  });
  it('keeps a cancelled multi-touch gesture disarmed until every remaining finger is released', () => {
    const view = mountChart(), first = { ...view.position(0, 'touch'), pointerId: 1 }, second = { ...view.position(3, 'touch'), pointerId: 2 }, third = { ...view.position(3, 'touch'), pointerId: 3 };
    fireEvent.pointerDown(view.slider, first); fireEvent.pointerDown(view.slider, second); fireEvent.pointerCancel(view.slider, first);
    fireEvent.pointerDown(view.slider, third); fireEvent.pointerUp(view.slider, third); fireEvent.pointerUp(view.slider, second);
    expect(view.select).not.toHaveBeenCalled();
    fireEvent.pointerDown(view.slider, first); fireEvent.pointerUp(view.slider, first);
    expect(view.select).toHaveBeenCalledExactlyOnceWith('2026-10-25');
  });
  it.each(['touch', 'mouse'])('ignores unowned %s releases and does not transfer authorization to a different pointer', pointerType => {
    const view = mountChart(), first = { ...view.position(0, pointerType), pointerId: 1 }, other = { ...view.position(3, pointerType), pointerId: 2 };
    fireEvent.pointerUp(view.slider, other); expect(view.select).not.toHaveBeenCalled();
    fireEvent.pointerDown(view.slider, first); fireEvent.pointerUp(view.slider, other); fireEvent.pointerUp(view.slider, first);
    expect(view.select).not.toHaveBeenCalled();
  });
  it('never selects outside coverage and preserves selected/focused semantics when finite motion is covered and resumes', () => {
    const view = mountChart(); act(() => view.slider.focus());
    fireEvent.pointerDown(view.slider, view.position(1)); fireEvent.pointerUp(view.slider, view.position(1));
    expect(screen.getByRole('tooltip')).toHaveTextContent('خارج از پوشش'); expect(view.select).not.toHaveBeenCalled();
    fireEvent.pointerMove(view.slider, view.position(3));
    const selected = view.container.querySelector('[data-price-marker="2026-10-25"]');
    view.rerenderCovered(true);
    expect(view.container.querySelector('[data-chart-selected]')).toHaveAttribute('data-motion-policy', 'static');
    expect(view.container.querySelector('[data-price-chart]')).toHaveAttribute('data-motion-policy', 'static');
    view.rerenderCovered(false);
    expect(view.container.querySelector('[data-chart-selected]')).toHaveAttribute('data-motion-policy', 'finite');
    expect(view.container.querySelector('[data-price-marker="2026-10-25"]')).toBe(selected);
    expect(selected).toHaveAttribute('data-selected', 'true'); expect(view.slider).toHaveFocus(); expect(view.select).not.toHaveBeenCalled();
  });
  it('has no invented tooltip or selection for an empty date window', () => {
    const select = vi.fn(); render(<DateChart cells={[]} selected="2026-10-25" leg="return" onSelect={select} />);
    const slider = screen.getByRole('slider'); expect(slider).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(slider, { key: 'ArrowRight' }); fireEvent.pointerMove(slider, { clientX: 10 });
    expect(select).not.toHaveBeenCalled(); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
