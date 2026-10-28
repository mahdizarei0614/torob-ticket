import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateWheel } from './date-wheel';
const dates = ['2026-10-25','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30'];
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('compact wheel previews and authorized settle', () => {
  it('previews drag frames, commits once after release at 250ms, and restores committed selection on pointer cancel', () => {
    vi.stubGlobal('PointerEvent', MouseEvent); vi.useFakeTimers(); const preview = vi.fn(), commit = vi.fn();
    render(<DateWheel dates={dates} value={dates[2]!} cells={[]} onPreview={preview} onCommit={commit} />);
    const wheel = screen.getByRole('listbox', { name: 'روزهای نزدیک' });
    fireEvent.pointerDown(wheel, { pointerId: 1, clientY: 180 });
    fireEvent.pointerMove(wheel, { pointerId: 1, clientY: 125 });
    expect(preview).toHaveBeenLastCalledWith(dates[3]); expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerUp(wheel, { pointerId: 1, clientY: 125 });
    act(() => vi.advanceTimersByTime(249)); expect(commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); expect(commit).toHaveBeenCalledExactlyOnceWith(dates[3]);
    fireEvent.pointerDown(wheel, { pointerId: 2, clientY: 180 }); fireEvent.pointerMove(wheel, { pointerId: 2, clientY: 80 }); fireEvent.pointerCancel(wheel, { pointerId: 2 });
    act(() => vi.advanceTimersByTime(300)); expect(commit).toHaveBeenCalledTimes(1); expect(preview).toHaveBeenLastCalledWith(dates[2]);
  });
  it('supports keyboard and wheel dates, chaining native scroll at a boundary', () => {
    vi.stubGlobal('PointerEvent', MouseEvent); vi.useFakeTimers(); const commit = vi.fn();
    render(<DateWheel dates={dates} value={dates[2]!} cells={[]} onPreview={() => undefined} onCommit={commit} />);
    const wheel = screen.getByRole('listbox', { name: 'روزهای نزدیک' });
    fireEvent.keyDown(wheel, { key: 'ArrowDown' }); act(() => vi.advanceTimersByTime(250)); expect(commit).toHaveBeenLastCalledWith(dates[3]);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 54 }); act(() => wheel.dispatchEvent(event)); expect(event.defaultPrevented).toBe(true); act(() => vi.advanceTimersByTime(250)); expect(commit).toHaveBeenLastCalledWith(dates[4]);
    fireEvent.keyDown(wheel, { key: 'End' }); act(() => vi.advanceTimersByTime(250)); const edge = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 }); wheel.dispatchEvent(edge); expect(edge.defaultPrevented).toBe(false);
    const zoom = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, ctrlKey: true }); wheel.dispatchEvent(zoom); expect(zoom.defaultPrevented).toBe(false);
  });
});
