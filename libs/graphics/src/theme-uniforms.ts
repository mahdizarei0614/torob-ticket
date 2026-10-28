import { useLayoutEffect, useState } from 'react';
import { Color, SRGBColorSpace, Vector4 } from 'three';
import { useTheme, type ThemeColors } from '@torob-ticket/ui';
export type ThemeUniforms = { [Key in keyof ThemeColors]: { value: Vector4 } };
/** Tokens currently use hex. Browser-normalized rgb/hsl colors are supported as well. */
export function resolveTokenColor(css: string) {
  let alpha = 1;
  let opaque = css.trim();
  // CSS palette interpolation emits fractional channels; Three's setStyle rgb parser accepts integers only.
  if (/^rgba?\(/i.test(opaque)) {
    const parts = opaque.slice(opaque.indexOf('(') + 1, -1).split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.every(Number.isFinite)) {
      const color = new Color().setRGB(parts[0]! / 255, parts[1]! / 255, parts[2]! / 255, SRGBColorSpace);
      return { r: color.r, g: color.g, b: color.b, a: parts[3] ?? 1 };
    }
  }
  if (/^#[\da-f]{8}$/i.test(opaque)) {
    alpha = parseInt(opaque.slice(7, 9), 16) / 255;
    opaque = opaque.slice(0, 7);
  } else if (/^#[\da-f]{4}$/i.test(opaque)) {
    alpha = parseInt(opaque[4]! + opaque[4]!, 16) / 255;
    opaque = opaque.slice(0, 4);
  } else if (/^rgba\(/i.test(opaque)) {
    const parts = opaque.slice(5, -1).split(',').map(value => value.trim());
    alpha = Number(parts[3]);
    opaque = `rgb(${parts.slice(0, 3).join(',')})`;
  } else if (opaque === 'transparent') {
    alpha = 0;
    opaque = 'rgb(0,0,0)'; // Transparent has no authored color.
  }
  const color = new Color().setStyle(opaque, SRGBColorSpace);
  return { r: color.r, g: color.g, b: color.b, a: alpha };
}
export function createThemeUniforms(colors: ThemeColors): ThemeUniforms {
  const uniforms = {} as ThemeUniforms;
  for (const key of Object.keys(colors) as (keyof ThemeColors)[]) uniforms[key] = { value: new Vector4() };
  updateThemeUniforms(uniforms, colors);
  return uniforms;
}
export function updateThemeUniforms(uniforms: ThemeUniforms, colors: ThemeColors) {
  for (const key of Object.keys(colors) as (keyof ThemeColors)[]) {
    const color = resolveTokenColor(colors[key]);
    uniforms[key].value.set(color.r, color.g, color.b, color.a);
  }
}
/** Stable objects: every active material can share these uniforms across theme switches. */
export function useThemeUniforms(onUpdate?: () => void) {
  const { themeBridge } = useTheme();
  const [uniforms] = useState<ThemeUniforms>(() => {
    const empty = Object.fromEntries(['background', 'dot', 'route', 'routeMuted', 'highlight', 'chartLine', 'chartGrid', 'chartMarker', 'priceLow', 'priceMid', 'priceHigh', 'focus'].map(key => [key, { value: new Vector4() }])) as ThemeUniforms;
    const snapshot = themeBridge.getSnapshot();
    if (snapshot) updateThemeUniforms(empty, snapshot.colors);
    return empty;
  });
  useLayoutEffect(() => {
    const snapshot = themeBridge.getSnapshot();
    if (snapshot) updateThemeUniforms(uniforms, snapshot.colors);
    return themeBridge.subscribe(theme => {
      updateThemeUniforms(uniforms, theme.colors);
      onUpdate?.();
    });
  }, [themeBridge, uniforms, onUpdate]);
  return uniforms;
}
