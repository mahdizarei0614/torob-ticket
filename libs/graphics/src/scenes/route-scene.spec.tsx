import { act, render,screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItinerarySchema, PlaceSchema, type GeoPoint } from '@torob-ticket/contracts';
import { GraphicsProvider } from '../graphics-provider';
import { projectPoint } from '../geo/projection';
import fixtures from '../geo/route-geometry.fixture.json';
import { RouteScene, type RouteSceneProps } from './route-scene';
// Test actual public DOM/camera lifecycle. GPU compilation has separate real-browser coverage.
vi.mock('../shared-renderer', () => ({ default: () => null }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() { /* Stable initial viewport aspect. */ } disconnect() { /* No native observer in jsdom. */ } }));
afterEach(() => vi.unstubAllGlobals());
const dots: GeoPoint[] = [{ longitude: 44.2, latitude: 26 }, { longitude: 54, latitude: 32.5 }, { longitude: 63.2, latitude: 39.5 }];
const places = fixtures.places.map(place => PlaceSchema.parse(place));
const itinerary = ItinerarySchema.parse(fixtures.scenarios[0]!.itinerary);
const preview = ItinerarySchema.parse(fixtures.scenarios[1]!.itinerary);
const base: RouteSceneProps = { places, dots, scope: 'domestic', fitKey: 'initial', projection: { centralLongitude: 54 } };
function element(props: RouteSceneProps) { return <GraphicsProvider><RouteScene {...props} /></GraphicsProvider>; }
function camera(container: HTMLElement) { return JSON.parse(container.querySelector<HTMLElement>('[data-route-scene] [data-camera]')!.dataset['camera']!) as { x: number; y: number; width: number; height: number; zoom: number }; }
function expectVisible(container: HTMLElement, points: readonly GeoPoint[], props: RouteSceneProps) {
  const frame = camera(container);
  for (const point of points) { const projected = projectPoint(point, props.projection); expect(Math.abs(projected[0] - frame.x)).toBeLessThanOrEqual(frame.width / 2); expect(Math.abs(projected[1] - frame.y)).toBeLessThanOrEqual(frame.height / 2); }
}
describe('public RouteScene projection and camera intent', () => {
  it.each(['empty', 'geography', 'illustrative'] as const)('keeps the domestic %s overview visible in a nonzero caller projection', async seam => {
    const props: RouteSceneProps = { ...base, ...(seam === 'geography' ? { itinerary, fitMode: 'geography' } : seam === 'illustrative' ? { illustrative: { points: dots, mode: 'flight', label: 'Illustrative endpoints' }, fitMode: 'geography' } : {}) };
    const view = render(element(props)); await act(async () => undefined);
    expect(camera(view.container).x).toBe(0); expectVisible(view.container, dots, props);
    if (seam !== 'geography') expect(view.container.querySelector('[data-segment-id]')).toBeNull();
  });
  it('fits an unpriced illustrative route using its projected endpoint bounds', async () => {
    const props: RouteSceneProps = { ...base, illustrative: { points: dots, mode: 'flight', label: 'Illustrative endpoints' } };
    const view = render(element(props)); await act(async () => undefined);
    expect(camera(view.container).x).toBeCloseTo(-.3); expectVisible(view.container, dots, props);
    expect(view.container.querySelector('[data-segment-id]')).toBeNull();
  });
  it('preserves preview/context changes until explicit fit or origin intent, then uses the current projected bounds', async () => {
    const props: RouteSceneProps = { ...base, itinerary, fitMode: 'geography', originKey: 'pinned-origin' };
    const view = render(element(props)); await act(async () => undefined);
    const initial = camera(view.container); expect(initial.x).toBe(0);
    const next = { ...props, itinerary: preview, projection: { centralLongitude: 10 } };
    view.rerender(element(next)); expect(camera(view.container)).toEqual(initial);
    view.rerender(element({ ...next, fitKey: 'deliberate-fit' })); expect(camera(view.container).x).toBe(44); expectVisible(view.container, dots, next);
    view.rerender(element({ ...next, fitKey: 'deliberate-fit', projection: { centralLongitude: 54 }, originKey: 'new-origin' })); expect(camera(view.container).x).toBe(0);
  });
  it('keeps the default composition and seam-straddling Iran/world overviews finite and visible', async () => {
    const view = render(element({ ...base, projection: { centralLongitude: 0 } })); await act(async () => undefined);
    expect(camera(view.container)).toMatchObject({ x: 54, y: 32.5, height: 17, zoom: 1 }); expect(camera(view.container).width).toBeCloseTo(23.8);
    const seam = { ...base, projection: { centralLongitude: -126 }, fitKey: 'seam-overview' };
    view.rerender(element(seam)); expectVisible(view.container, dots, seam); expect(camera(view.container).x).toBe(0); expect(camera(view.container).width).toBe(360);
    const worldDots = [{ longitude: -179, latitude: -59 }, { longitude: 179, latitude: 85 }, { longitude: 54, latitude: 32.5 }];
    const world: RouteSceneProps = { ...base, scope: 'international', dots: worldDots, projection: { centralLongitude: 54 }, fitKey: 'world-overview' };
    view.rerender(element(world)); expectVisible(view.container, worldDots, world); expect(camera(view.container).x).toBe(0); expect(camera(view.container).width).toBe(360);
  });
});
it('consumer city buttons/dropdown share actual city anchors, support disabled choices and fence retained controls',async()=>{
 let live=true;const selected=vi.fn();const changed=vi.fn();
 const city={id:'city-real',name:'شهر واقعی',countryCode:'IR',point:{latitude:32,longitude:54},timeZone:'Asia/Tehran'};
 const props:RouteSceneProps={...base,fitMode:'geography',cities:[{city,enabled:true,role:'origin'},{city:{...city,id:'disabled',name:'غیرفعال',point:{latitude:33,longitude:55}},enabled:false,role:'network'}],onCitySelect:selected,isCurrent:()=>live,onCameraIntentChange:changed,showTimeline:false};
 const view=render(element(props));await act(async()=>undefined);
 const enabled=view.getByRole('button',{name:'شهر واقعی · مبدا'});expect(enabled).toHaveAttribute('data-city-id','city-real');expect(view.getByRole('button',{name:'غیرفعال'})).toBeDisabled();expect(view.getByRole('option',{name:'غیرفعال'})).toBeDisabled();
 act(()=>enabled.click());expect(selected).toHaveBeenCalledWith('city-real');
 live=false;act(()=>enabled.click());act(()=>view.getByRole('button',{name:'بزرگ‌نمایی نقشه مسیر'}).click());expect(selected).toHaveBeenCalledTimes(1);expect(camera(view.container).zoom).toBe(1);
});
it('consumer camera snapshot survives responsive unmount and both directions share the deliberate fit',async()=>{
 const props:RouteSceneProps={...base,itinerary,fitBothDirections:true,onCameraIntentChange:vi.fn()};
 const view=render(element(props));await act(async()=>undefined);act(()=>view.getByRole('button',{name:'بزرگ‌نمایی نقشه مسیر'}).click());const fitted=camera(view.container);
 view.rerender(element({...props,direction:'return'}));expect(camera(view.container)).toEqual(fitted);view.unmount();
 const next=render(element({...props,initialCamera:{x:fitted.x,y:fitted.y,width:20,height:15,zoom:fitted.zoom}}));await act(async()=>undefined);expect(camera(next.container)).toMatchObject({x:fitted.x,y:fitted.y,zoom:1.25});
});
it('consumer linked label portal inherits its host and removes old controls across hide/remount/unmount',async()=>{
 const box={left:20,top:30,width:560,height:400,right:580,bottom:430,x:20,y:30,toJSON:()=>({})};
 const measure=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(box);
 const props:RouteSceneProps={...base,portalLabels:true,cities:[{city:{id:'real-city',name:'شهر',countryCode:'IR',point:{latitude:32,longitude:54},timeZone:'Asia/Tehran'},enabled:true,role:'origin'}],fitMode:'geography',onCitySelect:vi.fn()};
 const view=render(element(props));await act(async()=>undefined);
 const id=view.container.querySelector('[data-camera]')!.getAttribute('aria-controls')!;const label=view.container.querySelector('[data-graphics-label-layer] [data-scene-labels]');expect(label?.id).toBe(id);expect(label?.closest('[data-graphics-label-layer]')).not.toBeNull();expect(label?.parentElement).toHaveStyle({left:'20px',top:'30px',width:'560px',height:'400px'});
 view.rerender(element({...props,labelsVisible:false}));expect(view.container.querySelector('[data-scene-labels]')).toBeNull();
 view.rerender(element(props));expect(view.container.querySelectorAll('[data-scene-labels]')).toHaveLength(1);view.unmount();expect(document.querySelector('[data-scene-labels]')).toBeNull();measure.mockRestore();
});

it('uses friendly station labels for real marker controls, dropdown options and timeline without mutating source places',async()=>{
 const source=places.map(place=>place.id===itinerary.originPlaceId?{...place,kind:'station' as const,code:undefined,name:'ایستگاه نمونه تهران (خیالی)'}:{...place});const before=JSON.stringify(source);source.forEach(Object.freeze);
 const view=render(element({...base,places:source,itinerary,onPlaceSelect:vi.fn()}));await act(async()=>undefined);
 expect(screen.getByRole('button',{name:'ایستگاه تهران'})).toBeVisible();expect(screen.getByRole('option',{name:'ایستگاه تهران'})).toBeInTheDocument();
 expect(view.container.querySelector('[aria-label="ترتیب بخش‌های مسیر"]')).toHaveTextContent('ایستگاه تهران');expect(view.container.textContent).not.toContain('ایستگاه نمونه تهران (خیالی)');expect(JSON.stringify(source)).toBe(before);
});
