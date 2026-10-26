import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GraphicsProvider } from '../graphics-provider';
import { SceneSurface } from './scene-surface';

vi.mock('../shared-renderer', () => ({ default: () => null }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => vi.unstubAllGlobals());

it('handles trackpad pinch locally, preserves ordinary scroll and fences retired scene callbacks', () => {
  const setZoom = vi.fn(); let current = true;
  const pointer = { current: { x: 1, y: 2, active: true } };
  const props = { label: 'map', camera: { x: 0, y: 0, width: 360, height: 160, zoom: 1 }, setZoom, context: { centralLongitude: 0 }, markers: [], isCurrent: () => current, pointer, fallback: () => null, children: () => null };
  const view = render(<GraphicsProvider><SceneSurface {...props} /></GraphicsProvider>);
  const viewport = view.container.querySelector('[data-camera]')!;
  const scroll = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
  act(() => viewport.dispatchEvent(scroll)); expect(scroll.defaultPrevented).toBe(false); expect(setZoom).not.toHaveBeenCalled();
  expect(pointer.current.active).toBe(true);
  const pinch = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true });
  act(() => viewport.dispatchEvent(pinch)); expect(pinch.defaultPrevented).toBe(true); expect(setZoom).toHaveBeenLastCalledWith(Math.exp(.6));
  expect(pointer.current.active).toBe(false);
  view.rerender(<GraphicsProvider><SceneSurface {...props} camera={{ ...props.camera, zoom: 7 }} /></GraphicsProvider>);
  act(() => viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, ctrlKey: true, cancelable: true }))); expect(setZoom).toHaveBeenLastCalledWith(8);
  current = false; setZoom.mockClear();
  const obsolete = new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, cancelable: true });
  act(() => viewport.dispatchEvent(obsolete)); expect(obsolete.defaultPrevented).toBe(false); expect(setZoom).not.toHaveBeenCalled();
  view.unmount(); current = true;
  act(() => viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, cancelable: true }))); expect(setZoom).not.toHaveBeenCalled();
});
