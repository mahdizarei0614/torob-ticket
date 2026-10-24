import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './theme-provider';
// Root workspace asset/config; not a cross-project source import.
// eslint-disable-next-line @nx/enforce-module-boundaries
import bootstrap from '../../../../assets/theme-init.js?raw';

let dark = false;
let reduced = false;
let systemChange: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.appearance;
  delete document.documentElement.dataset.preference;
  dark = false;
  reduced = false;
  systemChange = undefined;
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('reduced') ? reduced : dark;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => {
      if (query.includes('color-scheme')) systemChange = listener;
    },
    removeEventListener: () => undefined,
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (document as Document & { startViewTransition?: unknown }).startViewTransition;
});
function Toggle() {
  const theme = useTheme();
  return (
    <>
      <output aria-label="appearance">{theme.appearance}</output>
      <button onClick={(event) => theme.setPreference('dark', event.currentTarget)}>Dark</button>
      <button onClick={() => theme.setPreference('system')}>System</button>
    </>
  );
}
it('runs before mount with a saved theme and survives blocked browser storage', () => {
  localStorage.setItem('torobticket.appearance', 'dark');
  new Function(bootstrap)();
  expect(document.documentElement.dataset.appearance).toBe('dark');
  localStorage.setItem('torobticket.appearance', 'invalid');
  dark = true;
  new Function(bootstrap)();
  expect(document.documentElement.dataset.appearance).toBe('dark');
  const storage = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  dark = false;
  new Function(bootstrap)();
  expect(document.documentElement.dataset.appearance).toBe('light');
  storage.mockRestore();
});
it('persists explicit choice, follows system changes only in system mode, and localizes its scope', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <ThemeProvider language="fa" mode="train">
      <Toggle />
    </ThemeProvider>,
  );
  expect(container.querySelector('[lang="fa"]')).toHaveAttribute('dir', 'rtl');
  await user.click(screen.getByText('Dark'));
  expect(localStorage.getItem('torobticket.appearance')).toBe('dark');
  dark = false;
  act(() => systemChange?.());
  expect(screen.getByLabelText('appearance')).toHaveTextContent('dark');
  await user.click(screen.getByText('System'));
  expect(screen.getByLabelText('appearance')).toHaveTextContent('light');
  dark = true;
  act(() => systemChange?.());
  await waitFor(() => expect(screen.getByLabelText('appearance')).toHaveTextContent('dark'));
  expect(document.documentElement.dataset.mode).toBe('train');
});
it('updates CSS and the graphics callback inside the transition update before revealing the new frame', async () => {
  const user = userEvent.setup();
  const events: string[] = [];
  Object.assign(document, {
    startViewTransition: (update: () => void) => {
      events.push('capture');
      update();
      events.push(`frame:${document.documentElement.dataset.appearance}`);
      return { ready: Promise.resolve(), finished: Promise.resolve(), skipTransition() {} };
    },
  });
  const animate = vi.fn();
  Object.assign(document.documentElement, { animate });
  render(
    <ThemeProvider
      language="en"
      mode="bus"
      onThemeChange={(theme) =>
        events.push(`bridge:${theme.appearance}:${document.documentElement.dataset.appearance}`)
      }
    >
      <Toggle />
    </ThemeProvider>,
  );
  events.length = 0;
  await user.click(screen.getByText('Dark'));
  expect(events.slice(0, 3)).toEqual(['capture', 'bridge:dark:dark', 'frame:dark']);
  expect(animate).toHaveBeenCalledWith(
    expect.objectContaining({ clipPath: expect.any(Array) }),
    expect.objectContaining({ duration: 260, pseudoElement: '::view-transition-new(root)' }),
  );
});
it('skips animation for reduced motion and uses direct updates without View Transitions', async () => {
  reduced = true;
  const user = userEvent.setup();
  const transition = vi.fn();
  Object.assign(document, { startViewTransition: transition });
  render(
    <ThemeProvider language="en" mode="flight">
      <Toggle />
    </ThemeProvider>,
  );
  await user.click(screen.getByText('Dark'));
  expect(screen.getByLabelText('appearance')).toHaveTextContent('dark');
  expect(transition).not.toHaveBeenCalled();
  delete (document as Document & { startViewTransition?: unknown }).startViewTransition;
  await user.click(screen.getByText('System'));
  expect(screen.getByLabelText('appearance')).toHaveTextContent('light');
});
