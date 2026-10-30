import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, StrictMode, useLayoutEffect, type RefObject } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SegmentedControl, type SegmentedControlProps } from './segmented-control';
import { MotionPolicyProvider } from '../motion/motion-surface';

let reduced = false, hidden = false;
const media = new Set<() => void>();
beforeEach(() => {
  reduced = false; hidden = false; media.clear();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_: string, fn: () => void) => media.add(fn), removeEventListener: (_: string, fn: () => void) => media.delete(fn) }));
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const flights = [{ id:'economy', label:'اقتصادی' }, { id:'business', label:'تجاری' }];
const trains = [{ id:'sleeper', label:'کوپه چهار تخته' }, { id:'seat', label:'صندلی' }, { id:'six', label:'کوپه شش تخته' }];
function Choice({ options, value = options[0]!.id, onChange = vi.fn(), covered = false, textEffect }: { options: SegmentedControlProps['options']; value?: string; onChange?: (value: string) => void; covered?: boolean; textEffect?: SegmentedControlProps['textEffect'] }) {
  return <MotionPolicyProvider covered={covered}><SegmentedControl label="کلاس سفر" value={value} onChange={onChange} options={options} textEffect={textEffect}/></MotionPolicyProvider>;
}
function FocusElsewhere({ target }: { target: RefObject<HTMLButtonElement | null> }) {
  useLayoutEffect(() => { target.current?.focus(); }, [target]);
  return <span/>;
}

it('immediately replaces live radio authority, retaining one group and transferring removed keyboard focus to the valid selection', async () => {
  const onChange = vi.fn(), user = userEvent.setup(), view = render(<Choice options={flights} onChange={onChange}/>);
  const group = screen.getByRole('radiogroup'), old = screen.getByRole('radio', { name:'اقتصادی' });
  await user.tab(); expect(old).toHaveFocus();
  view.rerender(<Choice options={trains} onChange={onChange}/>);
  expect(screen.getByRole('radiogroup')).toBe(group);
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  const selected = screen.getByRole('radio', { name:'کوپه چهار تخته' }); expect(selected).toBeChecked(); expect(selected).toHaveFocus();
  const ghost = old.closest('[data-segment-slot]')!;
  expect(ghost).toHaveAttribute('aria-hidden', 'true'); expect(ghost).toHaveAttribute('inert'); expect(old).toBeDisabled();
  expect(old.closest('[data-segment-option]')).toBeNull();
  fireEvent.click(old); expect(onChange).not.toHaveBeenCalled();
  await user.keyboard('{ArrowLeft}'); expect(onChange).toHaveBeenCalledWith('seat');
  await waitFor(() => expect(view.container.querySelectorAll('[data-segment-slot="outgoing"]')).toHaveLength(0));
});

it('retains shared option nodes and focus when the optional return direction enters or exits', async () => {
  const user = userEvent.setup(), onChange = vi.fn(), outbound = [{ id:'outbound', label:'تاریخ رفت' }], both = [...outbound, { id:'return', label:'تاریخ برگشت' }];
  const view = render(<Choice options={outbound} onChange={onChange}/>);
  const current = screen.getByRole('radio', { name:'تاریخ رفت' }); await user.tab(); expect(current).toHaveFocus();
  view.rerender(<Choice options={both} onChange={onChange}/>);
  expect(screen.getByRole('radio', { name:'تاریخ رفت' })).toBe(current); expect(current).toHaveFocus();
  view.rerender(<Choice options={outbound} onChange={onChange}/>);
  expect(screen.getAllByRole('radio')).toHaveLength(1); expect(current).toHaveFocus(); expect(onChange).not.toHaveBeenCalled();
});

it('lets an outside control which receives commit-time focus win over removed-option restoration', async () => {
  const external = createRef<HTMLButtonElement>(), user = userEvent.setup();
  const tree = (options: SegmentedControlProps['options']) => <><button ref={external} tabIndex={-1}>کنترل بیرونی</button><Choice options={options}/></>;
  const view = render(tree(flights)); await user.tab(); expect(screen.getByRole('radio', { name:'اقتصادی' })).toHaveFocus();
  view.rerender(tree(trains.map((option, index) => index === 0 ? { ...option, icon:<FocusElsewhere target={external}/> } : option)));
  expect(external.current).toHaveFocus();
});

it('bounds rapid distinct inventories to live options plus one obsolete cohort and never revives their callbacks', async () => {
  const onChange = vi.fn(), view = render(<Choice options={flights} onChange={onChange}/>);
  for (let index = 0; index < 20; index++) {
    const options = Array.from({ length:3 }, (_, item) => ({ id:`${index}-${item}`, label:`انتخاب ${index} ${item}` }));
    view.rerender(<Choice options={options} onChange={onChange}/>);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(view.container.querySelectorAll('[data-segment-slot]').length).toBeLessThanOrEqual(6);
    expect(screen.getByRole('radio', { name:`انتخاب ${index} 0` })).toBeChecked();
    for (const input of view.container.querySelectorAll<HTMLInputElement>('[data-segment-slot="outgoing"] input')) { expect(input).toBeDisabled(); fireEvent.click(input); }
  }
  expect(onChange).not.toHaveBeenCalled();
  await waitFor(() => expect(view.container.querySelectorAll('[data-segment-slot]')).toHaveLength(3));
});

it('keeps new current options available through StrictMode while their finite entry resumes', async () => {
  const view = render(<StrictMode><Choice options={flights}/></StrictMode>);
  view.rerender(<StrictMode><Choice options={trains}/></StrictMode>);
  const selected = screen.getByRole('radio', { name:'کوپه چهار تخته' }), slot = selected.closest<HTMLElement>('[data-segment-slot]')!;
  expect(selected).toBeChecked();
  await waitFor(() => { expect(slot.style.opacity).not.toBe(''); expect(Number(slot.style.opacity)).toBeGreaterThan(0); expect(Number(slot.style.opacity)).toBeLessThan(1); }, { interval:10 });
  await waitFor(() => expect(slot.style.opacity).toBe('1'));
});

it('revives the same retiring option from its visible opacity without reusing an earlier completed frame', async () => {
  const view = render(<Choice options={flights}/>), economic = screen.getByRole('radio', { name:'اقتصادی' });
  view.rerender(<Choice options={trains}/>);
  const slot = economic.closest<HTMLElement>('[data-segment-slot]')!;
  await waitFor(() => { expect(Number(slot.style.opacity)).toBeGreaterThan(0); expect(Number(slot.style.opacity)).toBeLessThan(.8); }, { interval:10 });
  const before = Number(slot.style.opacity);
  view.rerender(<Choice options={flights}/>);
  expect(screen.getByRole('radio', { name:'اقتصادی' })).toBe(economic); expect(economic).not.toBeDisabled();
  expect(Number(slot.style.opacity)).toBeCloseTo(before, 2);
  await waitFor(() => { expect(Number(slot.style.opacity)).toBeGreaterThan(before); expect(Number(slot.style.opacity)).toBeLessThan(1); }, { interval:10 });
  await waitFor(() => expect(slot.style.opacity).toBe('1'));
});

it('scrambles only entering opted-in option words, keeping immediate native names and unchanged options settled', async () => {
  const view = render(<Choice options={flights} textEffect="scramble"/>);
  view.rerender(<Choice options={trains} textEffect="scramble"/>);
  const selected = screen.getByRole('radio', { name:'کوپه چهار تخته' }); expect(selected).toBeChecked();
  const word = selected.closest('[data-segment-option]')!.querySelector<HTMLElement>('[data-motion-text-visual]')!;
  expect(word.textContent).not.toBe('کوپه چهار تخته');
  expect(selected.closest('[data-segment-option]')!.querySelector('[data-motion-text-reserve]')).toHaveTextContent('کوپه چهار تخته');
  await waitFor(() => expect(word.textContent).toBe('کوپه چهار تخته'));
  view.rerender(<Choice options={trains.map(option => ({ ...option }))} textEffect="scramble"/>);
  expect(screen.getByRole('radio', { name:'کوپه چهار تخته' })).toBe(selected); expect(word.textContent).toBe('کوپه چهار تخته');
});

it('settles a retiring word, then decodes the latest same-ID label without reviving its old phrase or callback', async () => {
  const onChange = vi.fn(), view = render(<Choice options={flights} textEffect="scramble" onChange={onChange}/>);
  const radio = screen.getByRole('radio', { name:'اقتصادی' });
  view.rerender(<Choice options={[{ id:'economy', label:'کوپه چهار تخته' }]} textEffect="scramble" onChange={onChange}/>);
  const word = radio.closest('[data-segment-option]')!.querySelector<HTMLElement>('[data-motion-text-visual]')!;
  expect(screen.getByRole('radio', { name:'کوپه چهار تخته' })).toBe(radio); expect(word.textContent).not.toBe('کوپه چهار تخته');
  view.rerender(<Choice options={trains} textEffect="scramble" onChange={onChange}/>);
  expect(word.textContent).toBe('کوپه چهار تخته'); expect(radio).toBeDisabled(); fireEvent.click(radio); expect(onChange).not.toHaveBeenCalled();
  view.rerender(<Choice options={[{ id:'economy', label:'صندلی سالنی' }]} textEffect="scramble" onChange={onChange}/>);
  expect(screen.getByRole('radio', { name:'صندلی سالنی' })).toBe(radio); expect(word.textContent).not.toBe('صندلی سالنی');
  await waitFor(() => expect(word.textContent).toBe('صندلی سالنی'));
  expect(radio.closest('[data-segment-option]')!.querySelector('[data-motion-text-reserve]')).toHaveTextContent('صندلی سالنی');
  expect(onChange).not.toHaveBeenCalled();
});

it.each(['covered', 'reduced', 'hidden'] as const)('clears obsolete %s visuals immediately and does not replay entry on resume', kind => {
  const view = render(<Choice options={flights}/>); view.rerender(<Choice options={trains}/>);
  if (kind === 'covered') view.rerender(<Choice options={trains} covered/>);
  else act(() => { if (kind === 'reduced') { reduced = true; media.forEach(fn => fn()); } else { hidden = true; document.dispatchEvent(new Event('visibilitychange')); } });
  expect(view.container.querySelector('[data-segment-slot="outgoing"]')).toBeNull();
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  if (kind === 'covered') view.rerender(<Choice options={trains}/>);
  else act(() => { if (kind === 'reduced') { reduced = false; media.forEach(fn => fn()); } else { hidden = false; document.dispatchEvent(new Event('visibilitychange')); } });
  for (const slot of view.container.querySelectorAll<HTMLElement>('[data-segment-slot]')) expect(Number(slot.style.opacity || '1')).toBe(1);
});
