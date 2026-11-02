import { StrictMode, type ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DatePriceSnapshotSchema } from '@torob-ticket/contracts';
import { MotionPolicyProvider } from '@torob-ticket/ui';
import { DateExplorer } from './date-explorer';
import { useDatePrices } from './use-date-prices';
import { catalog, query, session } from '../search/search-test-data';

vi.mock('./use-date-prices', () => ({ useDatePrices: vi.fn() }));
vi.mock('@torob-ticket/graphics/host', () => ({ GraphicsView: ({ fallback }: { fallback: ReactNode }) => <div data-owned-chart-view>{fallback}</div> }));
const dates = ['2026-10-25', '2026-10-26'];
const coverage = { complete: true, expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [] };
const observedAt = '2026-10-25T06:00:00.000Z';
const snapshot = (partial = false) => DatePriceSnapshotSchema.parse({ datePriceId: 'actual-days', clientGeneration: 'dates', query: { query, leg: 'outbound', dates, clientGeneration: 'dates' }, status: partial ? 'checking' : 'complete', observedAt, cells: [
  { date: dates[0], status: 'priced', minimum: { amountRial: 1000000, currency: 'IRR' }, quoteIds: ['q'], offerIds: ['o'], observedAt, coverage },
  partial ? { date: dates[1], status: 'checking' } : { date: dates[1], status: 'no-match', coverage },
] });
const props = { draft: query, catalog, session, onCommit: vi.fn(), onPreview: vi.fn(), onCovered: vi.fn(), onInteractionChange: vi.fn() };
const pending = () => vi.mocked(useDatePrices).mockReturnValue({ waiting: true, retryable: false, retry: vi.fn() });
beforeEach(() => { vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} })); pending(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('retires pending pixels while current partial prices take authority without remounting the chart or wheel', async () => {
  const tree = () => <StrictMode><DateExplorer {...props} /></StrictMode>;
  const view = render(tree());
  const chart = view.container.querySelector('[data-chart-selected]'), graphics = view.container.querySelector('[data-owned-chart-view]');
  const selected = within(screen.getByRole('listbox', { name: 'روزهای نزدیک' })).getByRole('option', { selected: true });
  expect(chart).toHaveAttribute('data-chart-loading', 'true');
  expect(selected).toHaveAccessibleName(/در حال بررسی/);
  expect(selected.querySelector('[data-date-amount-state]')).toHaveAttribute('data-date-amount-state', 'loading');
  expect(view.container.querySelectorAll('[data-price-marker]')).toHaveLength(0);
  vi.mocked(useDatePrices).mockReturnValue({ waiting: false, retryable: false, retry: vi.fn(), snapshot: snapshot(true) });
  view.rerender(tree());
  expect(view.container.querySelector('[data-chart-selected]')).toBe(chart);
  expect(view.container.querySelector('[data-owned-chart-view]')).toBe(graphics);
  expect(chart).toHaveAttribute('data-chart-loading', 'false');
  expect(within(screen.getByRole('listbox')).getByRole('option', { selected: true })).toBe(selected);
  expect(selected).toHaveAccessibleName(/۱۰۰٬۰۰۰ تومان/);
  expect(selected).not.toHaveAccessibleName(/در حال بررسی/);
  const exiting = view.container.querySelectorAll('[data-date-loading-stage="exiting"]');
  expect(exiting.length).toBeGreaterThan(0);
  exiting.forEach(node => { expect(node).toHaveAttribute('inert'); expect(node).toHaveAttribute('aria-hidden', 'true'); });
  expect(view.container.querySelector('[data-chart-loading-visual]')?.closest('[data-date-loading-stage]')).toHaveAttribute('aria-hidden', 'true');
  expect(within(screen.getByRole('listbox')).getAllByRole('option').find(node => node.getAttribute('aria-label')?.includes('در حال بررسی'))?.querySelector('[data-loading-pulse]')).toHaveAttribute('data-animate');
  await waitFor(() => expect(view.container.querySelectorAll('[data-date-loading-stage="exiting"]')).toHaveLength(0));
  await waitFor(() => expect(chart).toHaveAttribute('data-chart-opacity', '1'), { timeout: 2000 });
});

it('does not turn invalid input, a retrieval failure or settled no-match data into perpetual loading', () => {
  const view = render(<DateExplorer {...props} draft={{ ...query, destinationCityId: '' }} />);
  expect(view.container.querySelector('[data-chart-selected]')).toHaveAttribute('data-chart-loading', 'false');
  expect(view.container.querySelector('[data-date-loading-stage="loading"]')).toBeNull();
  vi.mocked(useDatePrices).mockReturnValue({ waiting: false, retryable: true, retry: vi.fn(), error: new Error('offline') });
  view.rerender(<DateExplorer {...props} />);
  expect(screen.getByRole('alert')).toHaveTextContent('قیمت روزها دریافت نشد');
  expect(view.container.querySelector('[data-chart-selected]')).toHaveAttribute('data-chart-loading', 'false');
  expect(view.container.querySelector('[data-date-loading-stage="loading"]')).toBeNull();
  const complete = snapshot(); complete.cells = dates.map(date => ({ date, status: 'no-match' as const, coverage }));
  vi.mocked(useDatePrices).mockReturnValue({ waiting: false, retryable: false, retry: vi.fn(), snapshot: complete });
  view.rerender(<DateExplorer {...props} />);
  expect(view.container.querySelector('[data-chart-selected]')).toHaveAttribute('data-chart-loading', 'false');
  expect(view.container.querySelector('[data-date-loading-stage="loading"]')).toBeNull();
  expect(within(screen.getByRole('listbox')).getByRole('option', { selected: true })).toHaveAccessibleName(/پیشنهاد مطابق نیست/);
});

it.each(['covered', 'hidden', 'reduced', 'disabled'] as const)('settles pending exits under %s policy without replaying a ready entry', async boundary => {
  let suspended = true;
  if (boundary === 'hidden') vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => suspended ? 'hidden' : 'visible');
  if (boundary === 'reduced') vi.stubGlobal('matchMedia', () => ({ matches: suspended, addEventListener() {}, removeEventListener() {} }));
  const tree = () => <MotionPolicyProvider covered={suspended && boundary === 'covered'} disabled={suspended && boundary === 'disabled'}><DateExplorer {...props} /></MotionPolicyProvider>;
  const view = render(tree());
  expect(view.container.querySelector('[data-loading-pulse][data-animate]')).toBeNull();
  vi.mocked(useDatePrices).mockReturnValue({ waiting: false, retryable: false, retry: vi.fn(), snapshot: snapshot() });
  view.rerender(tree());
  await waitFor(() => expect(view.container.querySelectorAll('[data-date-loading-stage]')).toHaveLength(0));
  expect(view.container.querySelector('[data-chart-selected]')).toHaveAttribute('data-chart-opacity', '1');
  expect(within(screen.getByRole('listbox')).getByRole('option', { selected: true })).toHaveAccessibleName(/۱۰۰٬۰۰۰ تومان/);
  const ready = view.container.querySelector('[data-date-value-stage="ready"]');
  expect(ready).toHaveStyle({ opacity: '1' });
  suspended = false; view.rerender(tree());
  expect(view.container.querySelector('[data-date-value-stage="ready"]')).toBe(ready);
  expect(ready).toHaveStyle({ opacity: '1' });
});
