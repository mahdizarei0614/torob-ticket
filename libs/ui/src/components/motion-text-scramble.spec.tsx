import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MotionText } from './motion-text';
import { MotionPolicyProvider } from '../motion/motion-surface';

let reduced = false, hidden = false;
const media = new Set<() => void>();
beforeEach(() => {
  reduced = false; hidden = false; media.clear();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_: string, fn: () => void) => media.add(fn), removeEventListener: (_: string, fn: () => void) => media.delete(fn) }));
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const phrase = (value: string, props: { covered?: boolean; disabled?: boolean; appear?: boolean } = {}) => <MotionPolicyProvider covered={props.covered} disabled={props.disabled}><h2 dir="rtl"><MotionText value={value} effect="scramble" appear={props.appear}/></h2></MotionPolicyProvider>;
const visual = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-motion-text-visual="current"]')!;

it('keeps exact current semantics and whole Persian text while preserving spaces, ZWNJ, marks, digits, codes and punctuation', async () => {
  const value = 'پروازهای یک‌طرفه ۱۴۰۵/۰۸ – IKA→IST (THR) 123، مُقصد';
  const view = render(phrase(value, { appear:true })), text = visual(view.container);
  expect(screen.getByRole('heading', { name:value })).toBeInTheDocument(); expect(text).toHaveAttribute('aria-hidden', 'true');
  expect(view.container.querySelector('[data-motion-text-accessible]')).toHaveTextContent(value);
  expect(text.childNodes).toHaveLength(1); expect(text.firstChild?.nodeType).toBe(Node.TEXT_NODE);
  expect(text.textContent).not.toBe(value);
  const target = Array.from(value), displayed = Array.from(text.textContent!);
  expect(displayed).toHaveLength(target.length);
  target.forEach((character, index) => { if (!/\p{Letter}/u.test(character) || !/\p{Script=Arabic}/u.test(character)) expect(displayed[index]).toBe(character); });
  await waitFor(() => expect(text.textContent).toBe(value));
});

it('reserves final phrase content independently from multiple decorative updates, without rebuilding its geometry owner', async () => {
  const value = 'کوپه چهار تخته و صندلی سالنی';
  const view = render(phrase(value, { appear:true })), text = visual(view.container), initial = text.textContent;
  const reserve = view.container.querySelector('[data-motion-text-reserve]')!, semantic = view.container.querySelector('[data-motion-text-accessible]')!;
  const changes: MutationRecord[] = [], observer = new MutationObserver(records => changes.push(...records));
  observer.observe(reserve, { childList:true, characterData:true, subtree:true });
  await waitFor(() => { expect(text.textContent).not.toBe(initial); expect(text.textContent).not.toBe(value); }, { interval:10 });
  expect(view.container.querySelector('[data-motion-text-reserve]')).toBe(reserve); expect(reserve.textContent).toBe(value);
  expect(semantic.textContent).toBe(value); expect(reserve).toHaveAttribute('aria-hidden', 'true'); expect(changes).toHaveLength(0);
  await waitFor(() => expect(text.textContent).toBe(value)); observer.disconnect(); expect(changes).toHaveLength(0);
});

it('does not replay an unchanged phrase and keeps the latest value through rapid interruptions', async () => {
  const view = render(phrase('مقایسه پروازها')), text = visual(view.container);
  expect(text.textContent).toBe('مقایسه پروازها'); view.rerender(phrase('مقایسه پروازها')); expect(text.textContent).toBe('مقایسه پروازها');
  for (let index = 0; index < 20; index++) {
    const next = `مقایسه قطارها ${index}`; view.rerender(phrase(next));
    expect(screen.getByRole('heading')).toHaveAccessibleName(next);
    expect(view.container.querySelectorAll('[data-motion-text-visual]')).toHaveLength(1);
    expect(view.container.querySelectorAll('[data-motion-text-reserve]')).toHaveLength(1);
  }
  await waitFor(() => expect(text.textContent).toBe('مقایسه قطارها 19'));
  view.rerender(phrase('مقایسه قطارها 19')); expect(text.textContent).toBe('مقایسه قطارها 19');
});

it('resumes finite decoding during StrictMode replay and cancels its owner cleanly on unmount', async () => {
  const value = 'مقایسه سفرهای تازه', view = render(<StrictMode>{phrase(value, { appear:true })}</StrictMode>), text = visual(view.container);
  expect(text.textContent).not.toBe(value);
  await waitFor(() => expect(text.textContent).toBe(value));
  view.rerender(<StrictMode>{phrase('انتخاب تازه')}</StrictMode>); view.unmount(); expect(media.size).toBe(0);
});

it.each(['covered', 'disabled', 'reduced', 'hidden'] as const)('settles %s decoding immediately and never replays it after resuming', kind => {
  const value = 'کوپه چهار تخته', view = render(phrase(value, { appear:true })), text = visual(view.container);
  expect(text.textContent).not.toBe(value);
  if (kind === 'covered' || kind === 'disabled') view.rerender(phrase(value, { [kind]:true, appear:true }));
  else act(() => { if (kind === 'reduced') { reduced = true; media.forEach(fn => fn()); } else { hidden = true; document.dispatchEvent(new Event('visibilitychange')); } });
  expect(text.textContent).toBe(value);
  if (kind === 'covered' || kind === 'disabled') view.rerender(phrase(value, { appear:true }));
  else act(() => { if (kind === 'reduced') { reduced = false; media.forEach(fn => fn()); } else { hidden = false; document.dispatchEvent(new Event('visibilitychange')); } });
  expect(text.textContent).toBe(value); expect(screen.getByRole('heading')).toHaveAccessibleName(value);
});
