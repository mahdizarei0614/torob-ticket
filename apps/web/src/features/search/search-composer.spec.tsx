import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionPolicyProvider } from '@torob-ticket/ui';
import { DateExplorer } from '../dates/date-explorer';
import { SearchComposer } from './search-composer';
import { validateDraft, type SearchDraft } from './search-url';
import { catalog, query, session } from './search-test-data';

const animation = vi.hoisted(() => ({ fields: new Map<string, { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> }>() }));
vi.mock('motion/react', async original => {
  const actual = await original<typeof import('motion/react')>(), { forwardRef, createElement, useRef } = await import('react');
  const Div = forwardRef<HTMLDivElement, Record<string, unknown>>(function FeedbackDiv({ children, animate, ...props }, ref) {
    delete props['initial'];
    if (props['data-search-field']) animation.fields.set(String(props['data-search-field']), animate as never);
    return createElement('div', { ...props, ref }, children as import('react').ReactNode);
  });
  const Span = forwardRef<HTMLSpanElement, Record<string, unknown>>(function FeedbackSpan({ children, ...props }, ref) { delete props['animate']; delete props['initial']; return createElement('span', { ...props, ref }, children as import('react').ReactNode); });
  return { ...actual, useAnimationControls: () => { const current = useRef({ start: vi.fn(async () => undefined), stop: vi.fn(), set: vi.fn() }); return current.current; }, motion: new Proxy(actual.motion, { get: (target, key, receiver) => key === 'div' ? Div : key === 'span' ? Span : Reflect.get(target, key, receiver) }) };
});
vi.mock('../dates/date-chart', () => ({ DateChart: () => null }));
vi.mock('../dates/use-date-prices', () => ({ useDatePrices: () => ({ waiting: false, retryable: false }) }));

let reduced = false;
const media = new Set<() => void>();
beforeEach(() => {
  reduced = false; media.clear(); animation.fields.clear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_: string, callback: () => void) => media.add(callback), removeEventListener: (_: string, callback: () => void) => media.delete(callback) }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); });
function Form({ initial = query, pending = false, disabled = false, covered = false, explorer = false, submit = vi.fn() }: { initial?: SearchDraft; pending?: boolean; disabled?: boolean; covered?: boolean; explorer?: boolean; submit?: () => void }) {
  const [draft, setDraft] = useState(initial);
  return <MotionPolicyProvider covered={covered}><SearchComposer draft={draft} catalog={catalog} session={session} edit={patch => setDraft(previous => ({ ...previous, ...patch }))} onSubmit={submit} errors={validateDraft(draft, catalog, session).errors} pending={pending} disabled={disabled} dateExplorer={explorer ? <DateExplorer draft={draft} catalog={catalog} session={session} onCommit={setDraft} onPreview={vi.fn()} onCovered={vi.fn()} onInteractionChange={vi.fn()} /> : undefined} /></MotionPolicyProvider>;
}
describe('deliberate inline search validation', () => {
  it('keeps the owned outbound choice visible in the same four-control row, then reveals return without replacing date controls', async () => {
    const user = userEvent.setup(), submit = vi.fn(), view = render(<Form explorer submit={submit}/>);
    const row = view.container.querySelector<HTMLElement>('[data-search-controls]')!;
    const legs = within(row).getByRole('radiogroup', { name:'جستجو بر اساس' });
    expect(row.children).toHaveLength(4);
    expect(within(row).getByRole('combobox', { name:'مبدا' })).toBeInTheDocument();
    expect(within(row).getByRole('combobox', { name:'مقصد' })).toBeInTheDocument();
    expect(within(row).getByRole('radiogroup', { name:'کلاس سفر' })).toBeInTheDocument();
    expect(within(legs).getByText('جستجو بر اساس')).toBeInTheDocument();
    expect(within(legs).getAllByRole('radio')).toHaveLength(1);
    const outbound = within(legs).getByRole('radio', { name:'تاریخ رفت' }); expect(outbound).toBeChecked();
    const explorer = screen.getByRole('region', { name:'کاوش تاریخ سفر' }), calendar = screen.getByRole('button', { name:'تقویم جلالی و انتخاب تاریخ' });
    await user.click(outbound); expect(explorer).toHaveAttribute('data-selected-outbound',query.departureDate); expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('radio', { name:'رفت‌وبرگشت' }));
    expect(within(legs).getAllByRole('radio')).toHaveLength(2); expect(row.children).toHaveLength(4);
    await user.click(within(legs).getByRole('radio', { name:'تاریخ برگشت' }));
    expect(screen.getByRole('region', { name:'کاوش تاریخ سفر' })).toBe(explorer);
    expect(explorer).toHaveAttribute('data-date-leg','return'); expect(explorer).toHaveAttribute('data-selected-return','');
    expect(screen.getByRole('button', { name:'تقویم جلالی و انتخاب تاریخ' })).toBe(calendar); expect(submit).not.toHaveBeenCalled();
  });
  it('portals the owned round-trip leg segments beside class without committing dates, retaining the same explorer/calendar control', async () => {
    const user = userEvent.setup(), submit = vi.fn();
    const view = render(<Form initial={{...query,tripType:'round-trip',returnDate:'2026-10-28'}} explorer submit={submit}/>);
    const preferences = view.container.querySelector<HTMLElement>('[data-search-preferences]')!;
    const legs = within(preferences).getByRole('radiogroup', { name:'جستجو بر اساس' });
    expect(preferences.children).toHaveLength(4);
    expect(within(preferences).getByRole('radiogroup', { name:'کلاس سفر' })).toBeInTheDocument();
    const explorer = screen.getByRole('region', { name:'کاوش تاریخ سفر' }), calendar = screen.getByRole('button', { name:'تقویم جلالی و انتخاب تاریخ' });
    expect(explorer.contains(legs)).toBe(false); expect(explorer).toHaveAttribute('data-date-leg','outbound');
    await user.click(within(legs).getByRole('radio', { name:'تاریخ برگشت' }));
    expect(explorer).toHaveAttribute('data-date-leg','return'); expect(explorer).toHaveAttribute('data-selected-return','2026-10-28');
    await user.keyboard('{ArrowRight}'); expect(explorer).toHaveAttribute('data-date-leg','outbound');
    expect(explorer).toHaveAttribute('data-selected-outbound',query.departureDate); expect(screen.getByRole('button', { name:'تقویم جلالی و انتخاب تاریخ' })).toBe(calendar);
    expect(screen.queryByText(/برگشت ثابت|رفت ثابت/)).not.toBeInTheDocument(); expect(submit).not.toHaveBeenCalled();
    await user.click(calendar); expect(screen.getByText('قیمت‌ها به هزار تومان')).toBeInTheDocument();
    expect(screen.queryByText(/برگشت ثابت|رفت ثابت/)).not.toBeInTheDocument(); await user.click(screen.getByRole('button',{name:'انصراف'}));
    expect(explorer).toHaveAttribute('data-selected-return','2026-10-28'); expect(submit).not.toHaveBeenCalled();
  });
  it('anchors residual form errors to the submit control with a persistent accessible description', async () => {
    const user = userEvent.setup(), submit = vi.fn();
    render(<SearchComposer draft={query} catalog={catalog} session={session} edit={vi.fn()} onSubmit={submit} errors={['شرایط سفر را دوباره بررسی کنید.']} pending={false} disabled={false}/>);
    const button = screen.getByRole('button', { name:'جست‌وجوی سفر' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(); await user.click(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('شرایط سفر را دوباره بررسی کنید.');
    expect(button).toHaveFocus(); expect(button).toHaveAccessibleDescription('شرایط سفر را دوباره بررسی کنید.');
    expect(button.closest('[data-search-field="form"]')).toBeInTheDocument(); await user.keyboard('{Escape}');
    expect(button).toHaveAccessibleDescription('شرایط سفر را دوباره بررسی کنید.'); expect(submit).not.toHaveBeenCalled();
  });
  it('keeps an incomplete button invokable, then marks only invalid fields, focuses the useful input and replays finite feedback without submission', async () => {
    const submit = vi.fn(), user = userEvent.setup();
    render(<Form initial={{ ...query, destinationCityId: '' }} submit={submit} />);
    const button = screen.getByRole('button', { name: 'جست‌وجوی سفر' }), destination = screen.getByRole('combobox', { name: 'مقصد' }), origin = screen.getByRole('combobox', { name: 'مبدا' });
    expect(button).toBeEnabled(); expect(button).toHaveAttribute('data-invalid', 'true'); expect(destination).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('مبدا، مقصد و تاریخ سفر را کامل و معتبر انتخاب کنید.')).not.toBeInTheDocument();
    await user.click(button);
    expect(submit).not.toHaveBeenCalled(); expect(destination).toHaveFocus(); expect(destination).toHaveAttribute('aria-invalid', 'true');
    expect(destination).toHaveAccessibleDescription('شهر مقصد را از فهرست انتخاب کنید.'); expect(origin).not.toHaveAttribute('aria-invalid', 'true');
    const controls = animation.fields.get('destinationCityId')!; expect(controls.start).toHaveBeenCalledTimes(1);
    await user.click(button); expect(controls.start).toHaveBeenCalledTimes(2);
    await user.click(destination); await user.type(destination, 'پایان'); await user.click(screen.getByRole('option', { name: 'پایان' }));
    expect(destination).not.toHaveAttribute('aria-invalid', 'true'); expect(screen.queryByText('شهر مقصد را از فهرست انتخاب کنید.')).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute('data-invalid'); await user.click(button); expect(submit).toHaveBeenCalledOnce();
  });
  it('accepts keyboard submit attempts and focuses origin before a destination that cannot yet be edited', async () => {
    const submit = vi.fn(), user = userEvent.setup(); render(<Form initial={{ ...query, originCityId: '', destinationCityId: '' }} submit={submit} />);
    const origin = screen.getByRole('combobox', { name: 'مبدا' }), destination = screen.getByRole('combobox', { name: 'مقصد' });
    const button = screen.getByRole('button', { name: 'جست‌وجوی سفر' }); await user.click(button); await user.keyboard('{Escape}');
    act(() => button.focus()); await user.keyboard('{Enter}');
    expect(submit).not.toHaveBeenCalled(); expect(origin).toHaveFocus(); expect(destination).toBeDisabled(); expect(origin).toHaveAccessibleDescription('شهر مبدا را از فهرست انتخاب کنید.');
    expect(animation.fields.get('originCityId')!.start).toHaveBeenCalledTimes(2);
  });
  it.each([{ pending: true }, { disabled: true }, { covered: true }])('keeps real guards native disabled and rejects programmatic submits for %j', props => {
    const submit = vi.fn(); render(<Form {...props} initial={{ ...query, destinationCityId: '' }} submit={submit} />);
    expect(screen.getByRole('button', { name: /جست‌وجوی سفر/ })).toBeDisabled(); fireEvent.submit(screen.getByRole('form', { name: 'جست‌وجوی سفر' }));
    expect(submit).not.toHaveBeenCalled(); expect(screen.queryByText('شهر مقصد را از فهرست انتخاب کنید.')).not.toBeInTheDocument(); expect(animation.fields.get('destinationCityId')!.start).not.toHaveBeenCalled();
  });
  it('settles an active shake when covered/reduced and does not replay on resume, while reduced attempts keep errors usable', async () => {
    const user = userEvent.setup(), submit = vi.fn(), initial = { ...query, destinationCityId: '' };
    const view = render(<Form initial={initial} submit={submit} />); const button = screen.getByRole('button', { name: 'جست‌وجوی سفر' }), destination = screen.getByRole('combobox', { name: 'مقصد' }); await user.click(button);
    const controls = animation.fields.get('destinationCityId')!; expect(controls.start).toHaveBeenCalledOnce();
    view.rerender(<Form initial={initial} submit={submit} covered />); expect(controls.set).toHaveBeenLastCalledWith({ x: 0 });
    view.rerender(<Form initial={initial} submit={submit} />); expect(controls.start).toHaveBeenCalledOnce();
    act(() => { reduced = true; media.forEach(callback => callback()); }); await user.click(button);
    expect(controls.start).toHaveBeenCalledOnce(); expect(destination).toHaveAccessibleDescription('شهر مقصد را از فهرست انتخاب کنید.');
    expect(submit).not.toHaveBeenCalled();
  });
  it('attaches missing-return feedback to the labelled calendar control and clears it after a valid provisional apply', async () => {
    const user = userEvent.setup(), submit = vi.fn(); render(<Form initial={{ ...query, tripType: 'round-trip', returnDate: undefined }} explorer submit={submit} />);
    expect(screen.queryByText(/مسیر و تاریخ را انتخاب کنید تا قیمت/)).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'جست‌وجوی سفر' }); await user.click(button);
    const calendar = screen.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ' });
    expect(calendar).toHaveFocus(); expect(calendar).toHaveAccessibleDescription('تاریخ برگشت را انتخاب کنید.'); expect(calendar).toHaveAttribute('aria-invalid', 'true');
    expect(calendar).toHaveTextContent('تقویم و تاریخ'); expect(calendar.querySelector('svg')).toBeInTheDocument();
    expect(animation.fields.get('departureDate returnDate')!.start).toHaveBeenCalledOnce();
    await user.click(calendar); await user.click(screen.getByText('ورود تاریخ میلادی')); fireEvent.change(screen.getByLabelText('تاریخ برگشت میلادی در تقویم'), { target: { value: '2026-10-28' } });
    await user.click(screen.getByRole('button', { name: 'اعمال تاریخ‌ها' }));
    expect(calendar).not.toHaveAttribute('aria-invalid', 'true'); expect(button).not.toHaveAttribute('data-invalid'); expect(submit).not.toHaveBeenCalled();
    await user.click(button); expect(submit).toHaveBeenCalledOnce();
  });
  it('surfaces invalid hidden filters only after attempt and keeps a working correction action', async () => {
    const user = userEvent.setup(), submit = vi.fn(); render(<Form initial={{ ...query, filters: { providerIds: ['missing'] } }} submit={submit} />);
    expect(screen.queryByText('فیلترهای جست‌وجو را اصلاح یا پاک کنید.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'جست‌وجوی سفر' })); expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'اعتبار فیلترهای سفر' })).toHaveAccessibleDescription('فیلترهای جست‌وجو را اصلاح یا پاک کنید.');
    const clear = screen.getByRole('button', { name: 'پاک کردن فیلترها' }); expect(clear).toHaveFocus(); await user.click(clear);
    expect(screen.queryByText('فیلترهای جست‌وجو را اصلاح یا پاک کنید.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'جست‌وجوی سفر' })); expect(submit).toHaveBeenCalledOnce();
  });
});
