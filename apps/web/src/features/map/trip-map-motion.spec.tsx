import { act, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { catalog, query } from '../search/search-test-data';
import { TripMap } from './trip-map';
import type { TripMapController } from './use-trip-map';

const scene = vi.hoisted(() => ({ report: undefined as undefined | ((active: boolean) => void) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, error: undefined }) }));
vi.mock('@torob-ticket/graphics', () => ({ RouteScene: ({ onMotionChange }: { onMotionChange: (active: boolean) => void }) => { scene.report = onMotionChange; return <div data-testid="scene"/>; } }));
afterEach(() => { vi.unstubAllGlobals(); scene.report = undefined; });

function map() {
  const view = { query, mode: query.mode, scope: query.scope, direction: 'outbound', progress: 0 };
  return { view, presentationView: view, presentationSceneKey: 'same-route', fitKey: 'same-fit', state: { cameraMode: 'fit', projection: { centralLongitude: 54 } }, isPresentationCurrent: () => true, savePresentationCamera: vi.fn() } as unknown as TripMapController;
}
function motionPreference() {
  let reduced = false; const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_: string, listener: () => void) => listeners.add(listener), removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) }));
  return (next: boolean) => act(() => { reduced = next; listeners.forEach(listener => listener()); });
}

it('keeps visible ambience running independently of a finite route, pauses while covered and resumes on close', async () => {
  motionPreference(); const report = vi.fn(), controller = map();
  const view = render(<TripMap map={controller} catalog={catalog} desktop covered={false} onMotionChange={report}/>);
  expect(report).toHaveBeenLastCalledWith(true);
  await waitFor(() => expect(scene.report).toBeDefined());
  act(() => scene.report!(false)); expect(report).toHaveBeenLastCalledWith(true);
  view.rerender(<TripMap map={controller} catalog={catalog} desktop covered onMotionChange={report}/>);
  expect(report).toHaveBeenLastCalledWith(false);
  act(() => scene.report!(true)); expect(report).toHaveBeenLastCalledWith(false);
  view.rerender(<TripMap map={controller} catalog={catalog} desktop covered={false} onMotionChange={report}/>);
  expect(report).toHaveBeenLastCalledWith(true);
  const retired = scene.report!; view.unmount();
  expect(report).toHaveBeenLastCalledWith(false);
  act(() => retired(true)); expect(report).toHaveBeenLastCalledWith(false);
});

it('resumes the visible ambient loop after reduced motion and page visibility return to normal', () => {
  const preference = motionPreference(); const report = vi.fn();
  render(<TripMap map={map()} catalog={catalog} desktop covered={false} onMotionChange={report}/>);
  preference(true); expect(report).toHaveBeenLastCalledWith(false);
  preference(false); expect(report).toHaveBeenLastCalledWith(true);
  let hidden = true; const original = Object.getOwnPropertyDescriptor(document, 'hidden');
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  try {
    act(() => document.dispatchEvent(new Event('visibilitychange'))); expect(report).toHaveBeenLastCalledWith(false);
    hidden = false; act(() => document.dispatchEvent(new Event('visibilitychange'))); expect(report).toHaveBeenLastCalledWith(true);
  } finally { if (original) Object.defineProperty(document, 'hidden', original); else Reflect.deleteProperty(document, 'hidden'); }
});
