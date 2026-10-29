import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ResultsList } from './results-page';
import { useResults } from './use-results';
import { createResultsState, resultsReducer } from './results-reducer';
import { group, observedAt, recovery } from './results-test-data';
import { catalog, query } from '../search/search-test-data';
import { ResultPresence, ResultsPresence } from './result-motion';
const policy = vi.hoisted(() => ({ enabled: false }));
vi.mock('@torob-ticket/ui', async importOriginal => ({ ...await importOriginal<typeof import('@torob-ticket/ui')>(), useMotionPolicy: () => ({ enabled: policy.enabled }) }));
vi.mock('./use-results', () => ({ useResults: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); policy.enabled = false; });
const props = { allowDefaultSelection: false, generation: 'generation', searchId: 'search', query, catalog, isCurrent: () => true, refinementDisabled: false, draftChanged: false, onRefine: vi.fn(), onEdit: vi.fn() };

it('resumes an unfinished finite entry through StrictMode effect replay instead of snapping to the final frame', async () => {
 policy.enabled = true;
 vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
 const view = render(<StrictMode><ResultsPresence><ResultPresence collapse><div>Disclosure evidence</div></ResultPresence></ResultsPresence></StrictMode>);
 const entering = view.container.querySelector<HTMLElement>('[data-result-presence]')!;
 expect(entering.style.opacity).not.toBe('1');
 await waitFor(() => { const opacity = Number(entering.style.opacity); expect(opacity).toBeGreaterThan(0); expect(opacity).toBeLessThan(1); });
 await waitFor(() => expect(entering.style.opacity).toBe('1'), { timeout: 1500 });
 view.unmount();
});

it('reserves loading rows without invented fares, then replaces them with the received cards', async () => {
 vi.spyOn(Date, 'now').mockReturnValue(Date.parse(observedAt) + 1000);
 let state = createResultsState('generation', 'search');
 vi.mocked(useResults).mockImplementation(() => ({ state, dispatch: vi.fn(), now: Date.now(), connectionError: false, connectionState: 'settled', error: undefined, retryRead: vi.fn(), stored: undefined }));
 const view = render(<ResultsList {...props}/>);
 expect(screen.getByRole('status', { name: 'در حال دریافت پیشنهادهای فروشندگان' })).toHaveAttribute('aria-busy', 'true');
 expect(view.container.querySelector('[data-loading-skeleton]')?.children).toHaveLength(3);
 expect(screen.queryByRole('article')).not.toBeInTheDocument();
 state = resultsReducer(state, { type: 'receive', recovery: recovery([group('loaded')]) });
 view.rerender(<ResultsList {...props}/>);
 expect(screen.getByRole('article')).toHaveAttribute('data-group-id', 'loaded');
 const leaving = view.container.querySelector('[data-loading-skeleton]');
 if (leaving) expect(leaving.closest('[data-result-presence]')).toHaveAttribute('inert');
 await waitFor(() => expect(view.container.querySelector('[data-loading-skeleton]')).toBeNull());
});

it('keeps focused card and expanded evidence identities through an authorized presentation reorder', () => {
 vi.spyOn(Date, 'now').mockReturnValue(Date.parse(observedAt) + 1000);
 const slow = group('slow', 10000000), fast = { ...group('fast', 20000000), durationMinutes: 30 };
 const state = resultsReducer(createResultsState('generation', 'search'), { type: 'receive', recovery: recovery([slow, fast]) });
 vi.mocked(useResults).mockReturnValue({ state, dispatch: vi.fn(), now: Date.now(), connectionError: false, connectionState: 'settled', error: undefined, retryRead: vi.fn(), stored: undefined });
 const view = render(<ResultsList {...props}/>);
 const initial = screen.getAllByRole('article');
 const details = within(initial[0]!).getByRole('button', { name: 'جزئیات سفر' });
 fireEvent.click(details); details.focus();
 view.rerender(<ResultsList {...props} sort="fastest"/>);
 const reordered = screen.getAllByRole('article');
 expect(reordered[0]).toBe(initial[1]); expect(reordered[1]).toBe(initial[0]);
 expect(details).toHaveAttribute('aria-expanded', 'true'); expect(details).toHaveFocus();
});

it('opens, rapidly reverses and reopens details without moving focus, selecting a fare or requesting any scrolling',async()=>{
 policy.enabled=true;
 vi.spyOn(Date,'now').mockReturnValue(Date.parse(observedAt)+1000);
 const value=recovery([group('disclosure'),group('following')]);
 const state=resultsReducer(createResultsState('generation','search'),{type:'receive',recovery:value});
 const dispatch=vi.fn(),scroll=vi.fn(),select=vi.fn();HTMLElement.prototype.scrollIntoView=scroll;
 const scrollBy=vi.spyOn(window,'scrollBy').mockImplementation(()=>undefined);
 vi.mocked(useResults).mockReturnValue({state,dispatch,now:Date.now(),connectionError:false,connectionState:'settled',error:undefined,retryRead:vi.fn(),stored:value});
 const view=render(<ResultsList {...props} onSelectQuote={select}/>);select.mockClear();
 const initial=screen.getAllByRole('article'),heading=within(initial[0]!).getByRole('heading',{level:3}),toggle=within(initial[0]!).getByRole('button',{name:'جزئیات سفر'});
 toggle.focus();
 for(const expanded of [true,false,true]){fireEvent.click(toggle);expect(toggle).toHaveAttribute('aria-expanded',String(expanded));expect(toggle).toHaveFocus();expect(screen.getAllByRole('article')[0]).toBe(initial[0]);expect(within(initial[0]!).getByRole('heading',{level:3})).toBe(heading);}
 expect(initial[0]).toHaveAttribute('data-details-open','true');expect(select).not.toHaveBeenCalled();expect(scroll).not.toHaveBeenCalled();expect(scrollBy).not.toHaveBeenCalled();
 await waitFor(()=>expect(view.container.querySelector('[data-result-presence="exiting"]')).toBeNull(),{timeout:1500});
 expect(screen.getAllByRole('article')[1]).toBe(initial[1]);
});

it('makes normal-motion exits inert immediately and removes them after their finite fade', async () => {
 policy.enabled = true;
 const view = render(<ResultsPresence><ResultPresence key="fare"><button>Old fare</button></ResultPresence></ResultsPresence>);
 view.rerender(<ResultsPresence>{null}</ResultsPresence>);
 const leaving = view.container.querySelector('[data-result-presence="exiting"]');
 expect(leaving).toHaveAttribute('inert'); expect(leaving).toHaveAttribute('aria-hidden', 'true');
 expect(screen.queryByRole('button', { name: 'Old fare' })).not.toBeInTheDocument();
 await waitFor(() => expect(view.container.querySelector('[data-result-presence="exiting"]')).toBeNull(), { timeout: 1500 });
});

it('preserves expanded details, current DOM and focus when motion becomes covered/reduced and resumes', () => {
 policy.enabled = true;
 vi.spyOn(Date, 'now').mockReturnValue(Date.parse(observedAt) + 1000);
 const state = resultsReducer(createResultsState('generation', 'search'), { type: 'receive', recovery: recovery([group('kept')]) });
 vi.mocked(useResults).mockReturnValue({ state, dispatch: vi.fn(), now: Date.now(), connectionError: false, connectionState: 'settled', error: undefined, retryRead: vi.fn(), stored: undefined });
 const view = render(<ResultsList {...props}/>);
 const card = screen.getByRole('article'), details = within(card).getByRole('button', { name: 'جزئیات سفر' });
 fireEvent.click(details); details.focus();
 const evidence = card.querySelector('[id][class*="details"]');
 for (const enabled of [false, true, false]) {
  policy.enabled = enabled; view.rerender(<ResultsList {...props}/>);
  expect(screen.getByRole('article')).toBe(card); expect(details).toHaveAttribute('aria-expanded', 'true'); expect(details).toHaveFocus();
  expect(card.querySelector('[id][class*="details"]')).toBe(evidence);
 }
});

it('a retained obsolete list cannot replace current evidence or expire the newer session', () => {
 vi.spyOn(Date, 'now').mockReturnValue(Date.parse(observedAt) + 1000);
 const state = resultsReducer(createResultsState('generation', 'search'), { type: 'receive', recovery: recovery([group('old')]) });
 let current = true, expired = false;
 vi.mocked(useResults).mockImplementation(() => ({ state, dispatch: vi.fn(), now: Date.now(), connectionError: false, connectionState: expired ? 'expired' : 'settled', error: undefined, retryRead: vi.fn(), stored: undefined }));
 const evidence = { current: undefined as import('./results-page').ResultsEvidence | undefined };
 const onExpired = vi.fn();
 const view = render(<ResultsList {...props} isCurrent={() => current} evidenceRef={evidence} onSessionExpired={onExpired}/>);
 const oldSelection = evidence.current!.select;
 const next = { state: createResultsState('new-generation', 'new-search'), select: vi.fn() };
 evidence.current = next; current = false; expired = true;
 view.rerender(<ResultsList {...props} isCurrent={() => current} evidenceRef={evidence} onSessionExpired={onExpired}/>);
 expect(evidence.current).toBe(next); expect(onExpired).not.toHaveBeenCalled();
 oldSelection({ groupId: 'old', quoteId: 'old-quote', version: 1 });
 expect(evidence.current).toBe(next);
});
