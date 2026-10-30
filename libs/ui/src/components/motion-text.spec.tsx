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
const phrase = (value: string, covered = false, appear = false) => <MotionPolicyProvider covered={covered}><h2 dir="rtl"><MotionText value={value} appear={appear}/></h2></MotionPolicyProvider>;

it('keeps Persian phrases joined and exposes only the new accessible words while the outgoing visual exits', async () => {
  const view = render(phrase('پروازهای یک‌طرفه'));
  const current = view.container.querySelector('[data-motion-text-visual="current"]')!;
  expect(current.childNodes).toHaveLength(1); expect(current.firstChild?.nodeType).toBe(Node.TEXT_NODE);
  view.rerender(phrase('قطارهای رفت‌وبرگشت'));
  expect(screen.getByRole('heading', { name: 'قطارهای رفت‌وبرگشت' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /پرواز/ })).not.toBeInTheDocument();
  expect(view.container.querySelector('[data-motion-text-visual="current"]')).toBe(current);
  const old = view.container.querySelector('[data-motion-text-visual="outgoing"]')!;
  expect(old).toHaveTextContent('پروازهای یک‌طرفه'); expect(old).toHaveAttribute('aria-hidden', 'true'); expect(old).toHaveAttribute('inert');
  await waitFor(() => expect(view.container.querySelector('[data-motion-text-visual="outgoing"]')).toBeNull());
});

it('bounds rapid changes to one outgoing phrase and settles only the latest value', async () => {
  const view = render(phrase('شروع'));
  for (let index = 0; index < 40; index++) {
    view.rerender(phrase(`انتخاب ${index}`));
    expect(view.container.querySelectorAll('[data-motion-text-visual]')).toHaveLength(2);
    expect(screen.getByRole('heading')).toHaveAccessibleName(`انتخاب ${index}`);
  }
  await waitFor(() => expect(view.container.querySelector('[data-motion-text-visual="outgoing"]')).toBeNull());
  expect(screen.getByRole('heading')).toHaveAccessibleName('انتخاب 39');
});

it('does not animate unchanged renders or first appearance by default', () => {
  const view = render(phrase('اطلاعات سفر'));
  const current = view.container.querySelector<HTMLElement>('[data-motion-text-visual="current"]')!;
  expect(current.style.opacity).toBe('1');
  view.rerender(phrase('اطلاعات سفر'));
  expect(view.container.querySelector('[data-motion-text-visual="current"]')).toBe(current);
  expect(view.container.querySelector('[data-motion-text-visual="outgoing"]')).toBeNull();
  expect(current.style.opacity).toBe('1');
});

it('resumes an interrupted first appearance under development StrictMode instead of snapping it complete', async () => {
  const view = render(<StrictMode>{phrase('مقصد تازه', false, true)}</StrictMode>);
  const current = view.container.querySelector<HTMLElement>('[data-motion-text-visual="current"]')!;
  expect(Number(current.style.opacity)).toBeLessThan(1);
  await waitFor(() => expect(current.style.opacity).toBe('1'));
  expect(screen.getByRole('heading', { name: 'مقصد تازه' })).toBeInTheDocument();
});

it.each(['covered', 'reduced', 'hidden'] as const)('settles %s transitions immediately without replay on resume and releases policy listeners', async kind => {
  const view = render(phrase('پرواز'));
  view.rerender(phrase('قطار'));
  if (kind === 'covered') view.rerender(phrase('قطار', true));
  else act(() => { if (kind === 'reduced') { reduced = true; media.forEach(fn => fn()); } else { hidden = true; document.dispatchEvent(new Event('visibilitychange')); } });
  const current = view.container.querySelector<HTMLElement>('[data-motion-text-visual="current"]')!;
  expect(view.container.querySelector('[data-motion-text-visual="outgoing"]')).toBeNull(); expect(current.style.opacity).toBe('1'); expect(current.style.filter).toBe('blur(0px)');
  if (kind === 'covered') view.rerender(phrase('قطار'));
  else act(() => { if (kind === 'reduced') { reduced = false; media.forEach(fn => fn()); } else { hidden = false; document.dispatchEvent(new Event('visibilitychange')); } });
  expect(current.style.opacity).toBe('1'); expect(view.container.querySelector('[data-motion-text-visual="outgoing"]')).toBeNull();
  view.unmount(); expect(media.size).toBe(0);
});
