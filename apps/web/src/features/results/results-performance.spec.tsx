import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ResultsList, type ResultsPageProps } from './results-page';
import { useResults } from './use-results';
import { createResultsState, resultsReducer } from './results-reducer';
import { group, observedAt, recovery } from './results-test-data';
import { catalog, query } from '../search/search-test-data';

const rendered = vi.hoisted(() => ({ time: vi.fn() }));
vi.mock('./use-results', () => ({ useResults: vi.fn() }));
vi.mock('./format', async importOriginal => {
 const original = await importOriginal<typeof import('./format')>();
 return { ...original, localTime: (...args: Parameters<typeof original.localTime>) => { rendered.time(); return original.localTime(...args); } };
});
vi.mock('@torob-ticket/ui', async importOriginal => ({ ...await importOriginal<typeof import('@torob-ticket/ui')>(), useMotionPolicy: () => ({ enabled: true }) }));
afterEach(() => { vi.restoreAllMocks(); rendered.time.mockClear(); });

function setup(size = 64) {
 vi.spyOn(Date, 'now').mockReturnValue(Date.parse(observedAt) + 1000);
 const groups = Array.from({ length: size }, (_, index) => ({ ...group('row-' + index, 1000000 + index * 10000), durationMinutes: 1000 - index }));
 const value = recovery(groups); value.snapshot.status = 'complete';
 let state = resultsReducer(createResultsState('generation', 'search'), { type: 'receive', recovery: value });
 const dispatch = vi.fn();
 vi.mocked(useResults).mockImplementation(() => ({ state, dispatch, now: Date.now(), connectionError: false, connectionState: 'settled', error: undefined, retryRead: vi.fn(), stored: value }));
 const props: ResultsPageProps = { allowDefaultSelection: false, generation: 'generation', searchId: 'search', query, catalog, isCurrent: () => true, refinementDisabled: false, draftChanged: false, onRefine: vi.fn(), onEdit: vi.fn() };
 const view = render(<ResultsList {...props}/>);
 return { view, props, value, groups, state: () => state, update: (next: typeof state) => { state = next; view.rerender(<ResultsList {...props}/>); }, rerender: (changes: Partial<ResultsPageProps> = {}) => view.rerender(<ResultsList {...props} {...changes}/>) };
}

it('keeps every long-list fare reachable while deferring row rendering and eliminating per-row Motion work', () => {
 const test = setup();
 expect(screen.getAllByRole('article')).toHaveLength(64);
 expect(screen.getAllByRole('listitem')).toHaveLength(64);
 expect(screen.getByRole('list', { name: 'مسیرها و پیشنهادهای مقایسه‌شده' })).toHaveAttribute('data-result-rendering', 'deferred');
 expect(screen.getAllByRole('listitem').every(row => row.dataset.resultMotion === 'static')).toBe(true);
 const last = screen.getAllByRole('article').at(-1)!;
 const details = within(last).getByRole('button', { name: 'جزئیات سفر' });
 details.focus(); fireEvent.click(details);
 expect(details).toHaveFocus(); expect(details).toHaveAttribute('aria-expanded', 'true');
 expect(within(last).getByRole('region', { name: 'جزئیات مسیر رفت' })).toBeInTheDocument();
 test.view.unmount();
});

it('keeps small-list individual insertion/reorder animation', () => {
 const test = setup(8);
 expect(screen.getByRole('list', { name: 'مسیرها و پیشنهادهای مقایسه‌شده' })).toHaveAttribute('data-result-rendering', 'full');
 expect(screen.getAllByRole('listitem').every(row => row.dataset.resultMotion === 'finite')).toBe(true);
 test.view.unmount();
});

it('does not reformat unchanged cards on unrelated parent, hover callback or already-frozen updates', () => {
 const test = setup();
 const first = rendered.time.mock.calls.length;
 expect(first).toBeGreaterThanOrEqual(64);
 test.rerender({ onPreviewItinerary: vi.fn(), renderProviderAction: () => <button>provider</button> });
 expect(rendered.time).toHaveBeenCalledTimes(first);
 test.update(resultsReducer(test.state(), { type: 'freeze' }));
 expect(rendered.time).toHaveBeenCalledTimes(first);
 const frozen = test.state();
 for (let index = 0; index < 100; index++) expect(resultsReducer(frozen, { type: 'freeze' })).toBe(frozen);
 test.view.unmount();
});

it('updates only the selected fare while keeping another expanded/focused row and all keys intact', () => {
 const test = setup();
 const initial = screen.getAllByRole('article');
 const details = within(initial.at(-1)!).getByRole('button', { name: 'جزئیات سفر' });
 fireEvent.click(details); details.focus();
 rendered.time.mockClear();
 test.update(resultsReducer(test.state(), { type: 'select', selection: { groupId: 'row-0', quoteId: 'row-0-quote', version: 1 }, now: Date.now() }));
 expect(initial[0]).toHaveAttribute('data-selected', 'true');
 expect(rendered.time.mock.calls.length).toBeGreaterThan(0);
 expect(rendered.time.mock.calls.length).toBeLessThan(10);
 expect(details).toHaveFocus(); expect(details).toHaveAttribute('aria-expanded', 'true');
 expect(screen.getAllByRole('article')).toEqual(initial);
 test.view.unmount();
});

it('preserves long-list DOM, disclosure state and focus through a local presentation reorder', () => {
 const test = setup();
 const initial = screen.getAllByRole('article');
 const first = initial[0]!, details = within(first).getByRole('button', { name: 'جزئیات سفر' });
 fireEvent.click(details); details.focus();
 test.rerender({ sort: 'fastest' });
 const reordered = screen.getAllByRole('article');
 expect(reordered[0]).toBe(initial.at(-1)); expect(reordered.at(-1)).toBe(first);
 expect(details).toHaveFocus(); expect(details).toHaveAttribute('aria-expanded', 'true');
 expect(within(first).getByRole('region', { name: 'جزئیات مسیر رفت' })).toBeInTheDocument();
 expect(test.view.container.querySelectorAll('[data-price-card-id]')).toHaveLength(64);
 test.view.unmount();
});

it('updates offscreen fare expiry and late revocation even when its summary has been memoized', () => {
 const test = setup();
 const last = screen.getAllByRole('article').at(-1)!;
 expect(within(last).getByRole('button', { name: 'انتخاب پیشنهاد' })).toBeEnabled();
 const newer = recovery(test.groups.slice(0, -1), 2);
 test.update({ ...test.state(), frozen: true, latest: newer });
 expect(within(last).getByRole('button', { name: 'انتخاب پیشنهاد' })).toBeDisabled();
 expect(last.querySelector('[data-invalid-price]')).toHaveAttribute('data-invalid-price', 'unavailable');
 vi.spyOn(Date, 'now').mockReturnValue(Date.parse(observedAt) + 601000);
 test.rerender();
 expect(screen.getAllByRole('article').slice(0, -1).every(card => card.querySelector('[data-invalid-price="expired"]'))).toBe(true);
 test.view.unmount();
});
