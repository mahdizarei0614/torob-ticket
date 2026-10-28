import { expect, it } from 'vitest';
import { ProvinceBoundaryAsset } from './province-boundaries';

const asset = (coordinates: unknown, type = 'LineString') => ({ revision: 'local-v1', navigation: false, boundaries: [{ geometry: { type, coordinates } }] });

it('accepts bounded line and multiline data without introducing navigation facts', () => {
  expect(ProvinceBoundaryAsset.parse(asset([[45, 30], [46, 31]])).boundaries).toHaveLength(1);
  expect(ProvinceBoundaryAsset.parse(asset([[[45, 30], [46, 31]], [[46, 31], [47, 32]]], 'MultiLineString')).navigation).toBe(false);
});

it('rejects invalid geographic values, single-point lines and polygon payloads', () => {
  for (const coordinates of [[[181, 30], [46, 31]], [[45, 91], [46, 31]], [[NaN, 30], [46, 31]], [[45, 30]]]) {
    expect(ProvinceBoundaryAsset.safeParse(asset(coordinates)).success).toBe(false);
  }
  expect(ProvinceBoundaryAsset.safeParse(asset([[[45, 30], [46, 31]]], 'Polygon')).success).toBe(false);
  expect(ProvinceBoundaryAsset.safeParse({ ...asset([[45, 30], [46, 31]]), navigation: true }).success).toBe(false);
});

it('bounds the whole asset even when each individual multiline is valid', () => {
  const line = Array.from({ length: 256 }, (_, index) => [45 + index / 1000, 30]);
  expect(ProvinceBoundaryAsset.safeParse(asset(Array.from({ length: 48 }, () => line), 'MultiLineString')).success).toBe(false);
  const feature = asset([[45, 30], [46, 31]]).boundaries[0];
  expect(ProvinceBoundaryAsset.safeParse({ revision: 'local-v1', navigation: false, boundaries: Array(129).fill(feature) }).success).toBe(false);
});
