import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from '@torob-ticket/client';
import type { ReferralReceipt } from '@torob-ticket/contracts';
import { RetainedConsumerRoutes } from '../../routes';
import { catalog } from '../search/search-test-data';
import { group } from '../results/results-test-data';

const deferred = vi.hoisted(() => {
  let release!: () => void;
  return { ready: new Promise<void>(resolve => { release = resolve; }), release: () => release(), returns: [] as (() => void)[] };
});
vi.mock('./provider-page', async importOriginal => { await deferred.ready; return importOriginal(); });
vi.mock('./provider-route-frame', async importOriginal => {
  const { ProviderRouteFrame } = await importOriginal<typeof import('./provider-route-frame')>();
  return { ProviderRouteFrame: (props: Parameters<typeof ProviderRouteFrame>[0]) => { deferred.returns.push(props.onReturn); return <ProviderRouteFrame {...props} />; } };
});
vi.mock('../search/search-page', async () => {
  const { useState } = await import('react');
  return { SearchPage: ({ covered, onHandoff }: { covered: boolean; onHandoff: (receipt: unknown, checkpoint: unknown) => void }) => {
    const [count, setCount] = useState(0);
    return <section data-search-owner data-covered={covered}><output data-testid="retained-count">{count}</output><button onClick={() => setCount(value => value + 1)}>edit</button><button onClick={() => onHandoff({ referralId: 'r', handoffPath: '/provider-demo/r' }, {})}>handoff</button></section>;
  } };
});
function Navigate() { const navigate = useNavigate(); return <><button onClick={() => void navigate('/')}>fresh route</button><button onClick={() => void navigate(1)}>forward</button></>; }
function tree(path: string) { return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Navigate /><RetainedConsumerRoutes /></MemoryRouter></QueryClientProvider>; }
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

it('keeps cold and retained route recovery immediate, fences old loading callbacks and reads actual receipt only after the current route loads', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const row = group('receipt'), quote = row.eligibleQuotes[0]!;
  const get = vi.spyOn(apiClient, 'getReferral').mockImplementation(async referralId => ({ referralId, intentId: 'i', selection: { kind: 'transport', quoteId: quote.quoteId, quoteVersion: quote.version }, payload: { kind: 'transport', quote, itinerary: row.itinerary }, confirmedAt: '2026-10-25T06:01:00Z', handoffPath: `/provider-demo/${referralId}` } satisfies ReferralReceipt));
  vi.spyOn(apiClient, 'catalogReadonly').mockResolvedValue(catalog);
  const session = vi.spyOn(apiClient, 'session'), prepare = vi.spyOn(apiClient, 'prepareReferral'), confirm = vi.spyOn(apiClient, 'confirmReferral');
  const view = render(tree('/provider-demo/cold'));
  expect(screen.getByRole('heading', { name: 'جزئیات ارجاع' })).toBeVisible();
  expect(screen.getByRole('main')).toHaveFocus();
  expect(screen.getByRole('link', { name: 'شروع مقایسه تازه' })).toHaveAttribute('href', '/');
  expect(document.querySelector('[data-search-owner]')).not.toBeInTheDocument();
  expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'fresh route' }));
  fireEvent.click(screen.getByRole('button', { name: 'edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'handoff' }));
  const oldReturn = deferred.returns.at(-1)!;
  expect(document.querySelector('[data-search-owner]')).toHaveAttribute('data-covered', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'بازگشت به مقایسه سفر' }));
  expect(screen.getByTestId('retained-count')).toHaveTextContent('1');
  fireEvent.click(screen.getByRole('button', { name: 'forward' }));
  fireEvent.click(screen.getByRole('button', { name: 'بازگشت به مقایسه سفر' }));
  await act(async () => { deferred.release(); });
  expect(document.querySelector('[data-provider-page]')).not.toBeInTheDocument();
  expect(document.querySelector('[data-provider-route-frame]')).not.toBeInTheDocument();
  expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'handoff' }));
  await screen.findByText('ارجاع به فروشنده ثبت شد');
  await act(async () => oldReturn());
  expect(document.querySelector('[data-provider-page]')).toBeInTheDocument();
  expect(get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'بازگشت به مقایسه سفر' }));
  await waitFor(() => expect(document.querySelector('[data-search-owner]')).toHaveAttribute('data-covered', 'false'));
  expect(screen.getByTestId('retained-count')).toHaveTextContent('1');
  view.unmount();
  render(tree('/provider-demo/direct'));
  await screen.findByText('ارجاع به فروشنده ثبت شد');
  expect(get).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[data-search-owner]')).not.toBeInTheDocument();
  expect(session).not.toHaveBeenCalled(); expect(prepare).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
});
