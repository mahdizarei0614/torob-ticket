import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContentSwap } from './content-presence';
import { MotionPolicyProvider } from './motion-surface';

beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('keeps unchanged content and keyboard focus while data updates under the same identity', () => {
  const view = render(<ContentSwap identity="same"><button>Continue</button><p>Original conditions</p></ContentSwap>);
  const button = screen.getByRole('button'); act(() => button.focus());
  view.rerender(<ContentSwap identity="same"><button>Continue</button><p>Updated conditions</p></ContentSwap>);
  expect(document.activeElement).toBe(button);
  expect(screen.getByText('Updated conditions')).toBeVisible();
  expect(view.container.querySelectorAll('[data-content-presence]')).toHaveLength(1);
});

it('makes outgoing controls inert and hidden before their finite exit finishes', async () => {
  const view = render(<ContentSwap identity="old"><button>Old quote</button></ContentSwap>);
  const previous = screen.getByRole('button');
  view.rerender(<ContentSwap identity="new"><button>New quote</button></ContentSwap>);
  expect(previous.closest('[data-content-presence]')).toHaveAttribute('inert');
  expect(previous.closest('[data-content-presence]')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.queryByRole('button', { name: 'Old quote' })).toBeNull();
  expect(await screen.findByRole('button', { name: 'New quote' })).toBeEnabled();
  await waitFor(() => expect(previous.isConnected).toBe(false));
});

it('settles covered updates without replaying an entry when the foreground closes', async () => {
  const tree = (covered: boolean, identity: string) => <MotionPolicyProvider covered={covered}><ContentSwap identity={identity}><p>{identity}</p></ContentSwap></MotionPolicyProvider>;
  const view = render(tree(true, 'old'));
  view.rerender(tree(true, 'new'));
  await waitFor(() => expect(view.container.querySelectorAll('[data-content-presence]')).toHaveLength(1));
  view.rerender(tree(false, 'new'));
  expect(screen.getByText('new')).toBeVisible();
});

it('mounts the new identity immediately when hidden without waiting for a suspended animation frame', () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const view = render(<ContentSwap identity="old"><button>Old quote</button></ContentSwap>);
  view.rerender(<ContentSwap identity="new"><button>New quote</button></ContentSwap>);
  expect(screen.queryByRole('button', { name: 'Old quote' })).toBeNull();
  expect(screen.getByRole('button', { name: 'New quote' })).toBeEnabled();
  expect(view.container.querySelector('[data-content-presence="exiting"]')).toBeNull();
});
