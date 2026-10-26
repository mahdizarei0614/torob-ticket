import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ComparisonGroup } from '@torob-ticket/contracts';
import { JourneyCard } from './journey-card';
import { Explanation } from './explanation';
import { localDay, localTime, selectionFor } from './format';
import { createResultsState, resultsReducer, type QuoteSelection } from './results-reducer';
import { group, observedAt, recovery } from './results-test-data';
import { catalog as baseCatalog } from '../search/search-test-data';

const catalog = {
 ...baseCatalog,
 places: [
  { id: 'IKA', cityId: 'a', name: 'فرودگاه امام خمینی', kind: 'airport' as const, code: 'IKA', point: { latitude: 35, longitude: 51 }, timeZone: 'Asia/Tehran' },
  { id: 'MHD', cityId: 'b', name: 'فرودگاه مشهد', kind: 'airport' as const, code: 'MHD', point: { latitude: 36, longitude: 59 }, timeZone: 'Asia/Tehran' },
 ],
};
const now = Date.parse(observedAt);

function Harness({ data = group('compact'), onSelect = () => undefined, onContinue = () => undefined }: {
 data?: ComparisonGroup;
 onSelect?: (selection: QuoteSelection) => void;
 onContinue?: () => void;
}) {
 const [state, dispatch] = useReducer(resultsReducer, undefined, () => resultsReducer(createResultsState('generation', 'search'), { type: 'receive', recovery: recovery([data]) }));
 return <JourneyCard group={data} snapshot={state.adopted!.snapshot} catalog={catalog} state={state} now={now}
  onFreeze={() => dispatch({ type: 'freeze' })}
  onSelect={selection => { onSelect(selection); dispatch({ type: 'select', selection, now }); }}
  continuation={<button type="button" onClick={onContinue}>رفتن به فروشنده</button>}
 />;
}

describe('compact card selection and facts', () => {
 it('selects the exact quote with native Enter and Space activation and exposes the pressed state', async () => {
  const data = group('keyboard');
  const select = vi.fn();
  const user = userEvent.setup();
  render(<Harness data={data} onSelect={select}/>);
  const surface = screen.getByRole('button', { name: 'انتخاب پیشنهاد' });
  expect(surface.tagName).toBe('BUTTON');
  expect(surface).toHaveAttribute('data-card-select');
  expect(surface).toHaveAttribute('aria-pressed', 'false');
  expect(surface).toHaveAccessibleDescription(/فرودگاه امام خمینی به فرودگاه مشهد/);
  expect(surface).toHaveAccessibleDescription(/۱٬۰۰۰٬۰۰۰ تومان/);
  expect(surface.querySelector('button,a,input')).toBeNull();
  expect(screen.queryByRole('button', { name: 'رفتن به فروشنده' })).not.toBeInTheDocument();
  await user.tab();
  expect(surface).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(select).toHaveBeenLastCalledWith(selectionFor(data.groupId, data.eligibleQuotes[0]!));
  expect(surface).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('article')).toHaveAttribute('data-selected', 'true');
  expect(screen.getByLabelText('انتخاب‌شده')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'رفتن به فروشنده' })).toBeInTheDocument();
  await user.keyboard(' ');
  expect(select).toHaveBeenCalledTimes(2);
 });

 it('keeps route tooltips, details and provider continuation independent of card selection', async () => {
  const select = vi.fn();
  const continueToProvider = vi.fn();
  const user = userEvent.setup();
  render(<Harness onSelect={select} onContinue={continueToProvider}/>);
  await user.click(screen.getByRole('button', { name: 'فرودگاه امام خمینی' }));
  expect(select).not.toHaveBeenCalled();
  const details = screen.getByRole('button', { name: 'جزئیات و ۱ پیشنهاد فروشندگان' });
  await user.click(details);
  expect(details).toHaveAttribute('aria-expanded', 'true');
  expect(select).not.toHaveBeenCalled();
  const offer = screen.getByRole('region', { name: /پیشنهاد سفر/ });
  await user.click(within(offer).getByRole('button', { name: 'انتخاب این پیشنهاد' }));
  expect(select).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'رفتن به فروشنده' }));
  expect(continueToProvider).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('article').querySelector('button button')).toBeNull();
 });

 it('keeps both round-trip legs and overnight arrival dates visible with full details reachable', async () => {
  const data = group('overnight');
  const first = data.itinerary.outbound.segments[0]!;
  first.departureAt = '2026-10-25T19:30:00.000Z';
  first.arrivalAt = '2026-10-26T01:30:00.000Z';
  data.itinerary.return = {
   segments: [{ ...first, segmentId: 'return', serviceId: 'return-service', originPlaceId: 'MHD', destinationPlaceId: 'IKA', departureAt: '2026-10-27T20:30:00.000Z', arrivalAt: '2026-10-28T02:30:00.000Z' }],
   stops: [],
  };
  data.eligibleQuotes[0]!.conditions.return = structuredClone(data.eligibleQuotes[0]!.conditions.outbound);
  render(<Harness data={data}/>);
  const card = screen.getByRole('article');
  expect(card).toHaveTextContent(localDay(first.arrivalAt, first.arrivalTimeZone));
  const returning = data.itinerary.return.segments[0]!;
  expect(card).toHaveTextContent(`برگشت · ${localDay(returning.departureAt, returning.departureTimeZone)}`);
  expect(card).toHaveTextContent(localTime(returning.arrivalAt, returning.arrivalTimeZone));
  expect(card).toHaveTextContent(localDay(returning.arrivalAt, returning.arrivalTimeZone));
  await userEvent.setup().click(screen.getByRole('button', { name: 'جزئیات و ۱ پیشنهاد فروشندگان' }));
  expect(within(screen.getByRole('region', { name: 'جزئیات مسیر رفت' })).getAllByText('Asia/Tehran', { selector: 'small' })).toHaveLength(2);
  expect(screen.getByRole('region', { name: 'جزئیات مسیر برگشت' })).toHaveTextContent(localDay(returning.arrivalAt, returning.arrivalTimeZone));
 });

 it('shows unknowns, cancellation and material terms inside expanded provider details without an extra terms disclosure', async () => {
  const data = group('terms');
  data.eligibleQuotes[0]!.conditions.outbound.materialTerms = ['تغییر نام مسافر مجاز نیست'];
  render(<Harness data={data}/>);
  expect(screen.queryByText('بار همراه: نامشخص')).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'جزئیات و ۱ پیشنهاد فروشندگان' }));
  const offer = screen.getByRole('region', { name: /پیشنهاد سفر/ });
  expect(offer).toHaveTextContent('بار همراه: نامشخص');
  expect(offer).toHaveTextContent('جزئیات و جریمه لغو نامشخص است');
  expect(offer).toHaveTextContent('تغییر نام مسافر مجاز نیست');
  expect(offer).toHaveAttribute('data-offer-quote-id', 'terms-quote');
  expect(offer).toHaveAttribute('data-offer-quote-version', '1');
  expect(screen.queryByText(/شرایط و هزینه‌ها/)).not.toBeInTheDocument();
  await userEvent.setup().click(within(offer).getByText('ریز مبلغ کل'));
  expect(within(offer).getByText('کرایه پایه · اجباری')).toBeVisible();
 });

 it('keeps provisional price evidence concise without repeating stop counts or collection copy', () => {
  const data = group('reasons');
  const snapshot = recovery([data]).snapshot;
  snapshot.explanations = [{
   reasonCode: 'price-difference', baselineIds: ['reasons-quote', 'reasons-quote'],
   facts: { baselineQuoteVersion: 1, targetQuoteVersion: 1, provisional: 1, amountRial: 0 },
   coverage: snapshot.coverage,
  }];
  render(<Explanation group={data} snapshot={snapshot}/>);
  expect(screen.getByText('کمترین قیمت تا این لحظه')).toBeInTheDocument();
  expect(screen.queryByText('بدون توقف')).not.toBeInTheDocument();
  expect(screen.queryByText(/دریافت پیشنهادها ادامه دارد/)).not.toBeInTheDocument();
 });
});
