import { useId, type ReactNode } from 'react';
import { Vector2, Vector4 } from 'three';
import type { RouteBounds } from '../geo/projection';

interface ViewportSize { width: number; height: number }

/** CSS-pixel coverage stays stable while the camera zooms or the host changes DPR. */
function edgeInsets({ width, height }: ViewportSize) {
  return { left: Math.min(64, width * .15), right: Math.min(148, width * .3), vertical: Math.min(86, height * .2) };
}

export function createMapEdgeFadeUniforms() {
  return { mapFadeViewport: { value: new Vector2(560, 400) }, mapFadeInsets: { value: new Vector4(0, 0, 0, 0) } };
}

export function updateMapEdgeFadeUniforms(uniforms: ReturnType<typeof createMapEdgeFadeUniforms>, size: ViewportSize, enabled: boolean) {
  const viewport = { width: Math.max(1, size.width), height: Math.max(1, size.height) };
  const insets = edgeInsets(viewport);
  uniforms.mapFadeViewport.value.set(viewport.width, viewport.height);
  uniforms.mapFadeInsets.value.set(insets.left, insets.right, insets.vertical, enabled ? 1 : 0);
}

/** The fallback masks only geography; the itinerary and its selected markers remain clear. */
export function StaticMapEdgeFade({ children, enabled, frame, viewport }: {
  children: ReactNode; enabled: boolean; frame: RouteBounds; viewport: ViewportSize;
}) {
  const id = useId().replace(/:/g, '');
  if (!enabled) return <>{children}</>;
  const size = { width: Math.max(1, viewport.width), height: Math.max(1, viewport.height) };
  const insets = edgeInsets(size);
  const x = frame.x - frame.width / 2, y = -frame.y - frame.height / 2;
  const box = { x, y, width: frame.width, height: frame.height };
  const horizontal = `map-feather-x-${id}`, vertical = `map-feather-y-${id}`;
  // These stops approximate the shader's smoothstep, including its soft endpoints.
  const ramp = [0, .25, .5, .75, 1];
  const stops = (start: number, end: number) => <>
    {ramp.map(t => <stop key={`start-${t}`} offset={t * start} stopColor="var(--text)" stopOpacity={t * t * (3 - 2 * t)} />)}
    {ramp.map(t => <stop key={`end-${t}`} offset={1 - end + t * end} stopColor="var(--text)" stopOpacity={1 - t * t * (3 - 2 * t)} />)}
  </>;
  return <g data-geography-feather>
    <defs>
      <linearGradient id={`${horizontal}-gradient`} gradientUnits="userSpaceOnUse" x1={x} x2={x + frame.width} y1={y} y2={y}>
        {stops(insets.left / size.width, insets.right / size.width)}
      </linearGradient>
      <linearGradient id={`${vertical}-gradient`} gradientUnits="userSpaceOnUse" x1={x} x2={x} y1={y} y2={y + frame.height}>
        {stops(insets.vertical / size.height, insets.vertical / size.height)}
      </linearGradient>
      <mask id={horizontal} maskUnits="userSpaceOnUse" {...box} style={{ maskType: 'alpha' }}><rect {...box} fill={`url(#${horizontal}-gradient)`} /></mask>
      <mask id={vertical} maskUnits="userSpaceOnUse" {...box} style={{ maskType: 'alpha' }}><rect {...box} fill={`url(#${vertical}-gradient)`} /></mask>
    </defs>
    <g mask={`url(#${horizontal})`}><g mask={`url(#${vertical})`}>{children}</g></g>
  </g>;
}
