import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DateExplorer } from './date-explorer';
import { catalog, query, session } from '../search/search-test-data';

const deferred = vi.hoisted(() => {
  let release!: () => void;
  return { ready: new Promise<void>(resolve => { release = resolve; }), release: () => release() };
});
vi.mock('./date-calendar', async importOriginal => {
  await deferred.ready;
  return importOriginal();
});
vi.mock('./date-chart', () => ({ DateChart: () => null }));
vi.mock('./use-date-prices', () => ({ useDatePrices: () => ({ waiting: false, retryable: false }) }));

it('can cancel a cold calendar before its real contents arrive, then reopen with fresh provisional intent', async () => {
  const commit = vi.fn(), covered = vi.fn();
  render(<DateExplorer catalog={catalog} session={session} draft={query} onCommit={commit} onPreview={vi.fn()} onCovered={covered} onInteractionChange={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ' });
  fireEvent.click(trigger);
  expect(screen.getByRole('heading', { name: 'انتخاب تاریخ سفر' })).toBeVisible();
  expect(screen.getByText('در حال آماده‌سازی تقویم…')).toBeVisible();
  expect(screen.queryByText('ورود تاریخ میلادی')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'انصراف' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(covered).toHaveBeenLastCalledWith(false);
  await act(async () => { deferred.release(); });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(commit).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByText('ورود تاریخ میلادی'));
  fireEvent.change(screen.getByLabelText('تاریخ رفت میلادی در تقویم'), { target: { value: '2026-10-26' } });
  fireEvent.click(screen.getByRole('button', { name: 'اعمال تاریخ‌ها' }));
  expect(commit).toHaveBeenCalledExactlyOnceWith({ ...query, departureDate: '2026-10-26' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
