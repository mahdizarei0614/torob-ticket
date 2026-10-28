import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ShaderMaterial, BufferGeometry } from 'three';
import type { WorldCountry } from '../geo/world-context';
import { WorldGeography } from './world-geography';

const observed = vi.hoisted(() => ({ materials: [] as ShaderMaterial[], geometries: [] as BufferGeometry[], invalidate: vi.fn(), get: vi.fn(), uniforms: { dot: { value: null }, highlight: { value: null } } }));
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>();
  return { ...actual,
    ShaderMaterial: class extends actual.ShaderMaterial { constructor(...args: ConstructorParameters<typeof actual.ShaderMaterial>) { super(...args); observed.materials.push(this); } },
    BufferGeometry: class extends actual.BufferGeometry { constructor() { super(); observed.geometries.push(this); } },
  };
});
vi.mock('@react-three/fiber', () => ({ useThree: (selector: (state: { invalidate: typeof observed.invalidate; get: typeof observed.get }) => unknown) => selector({ invalidate: observed.invalidate, get: observed.get }), useFrame: vi.fn() }));
vi.mock('../theme-uniforms', () => ({ useThemeUniforms: () => observed.uniforms }));
const first: readonly WorldCountry[] = [{ geometry: { type: 'Polygon', coordinates: [[[44, 25], [63, 25], [63, 40], [44, 40], [44, 25]]] } }];
const second: readonly WorldCountry[] = [{ geometry: { type: 'Polygon', coordinates: [[[-20, -20], [40, -20], [40, 50], [-20, 50], [-20, -20]]] } }];
beforeEach(() => { observed.materials.length = 0; observed.geometries.length = 0; observed.get.mockReturnValue({ size: { width: 600, height: 400 } }); });
afterEach(() => vi.restoreAllMocks());

it('retains compiled material owners through scope/projection changes while releasing replaced geography and updating uniforms', () => {
  // DOM does not render R3F nodes; this checks real Three resource lifetimes only.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const frame = { x: 54, y: 33, width: 22, height: 17 };
  const view = render(<WorldGeography countries={first} context={{ centralLongitude: 0 }} frame={frame} domestic reducedMotion={false} />);
  expect(observed.materials).toHaveLength(3);
  const [morph, border, land] = observed.materials;
  const disposed = observed.materials.map(material => vi.spyOn(material, 'dispose'));
  const oldGeography = observed.geometries.slice(1).map(geometry => vi.spyOn(geometry, 'dispose'));
  view.rerender(<WorldGeography countries={second} context={{ centralLongitude: 20 }} frame={{ x: 0, y: 15, width: 360, height: 160 }} reducedMotion={false} />);
  expect(observed.materials).toEqual([morph, border, land]);
  disposed.forEach(dispose => expect(dispose).not.toHaveBeenCalled()); oldGeography.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
  expect(land!.uniforms['baseSpacing']!.value).toBe(4); expect(land!.uniforms['latticeSpacings']!.value.toArray()).toEqual([4, 1, .25, .0625]);
  expect(land!.uniforms['gridOrigin']!.value.toArray()).toEqual([-179, -59]); expect(land!.uniforms['centralLongitude']!.value).toBe(20);
  view.rerender(<WorldGeography countries={first} context={{ centralLongitude: 54 }} frame={frame} domestic reducedMotion={false} />);
  expect(observed.materials).toEqual([morph, border, land]); disposed.forEach(dispose => expect(dispose).not.toHaveBeenCalled());
  expect(land!.uniforms['baseSpacing']!.value).toBe(.44); expect(land!.uniforms['gridOrigin']!.value.toArray()).toEqual([44, 25]); expect(land!.uniforms['centralLongitude']!.value).toBe(54);
  view.unmount(); disposed.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
});
