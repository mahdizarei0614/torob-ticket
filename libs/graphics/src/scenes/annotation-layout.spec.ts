import { describe, expect, it } from 'vitest';
import { placeAnnotations } from './annotation-layout';

describe('selected route annotation placement', () => {
  it('separates clustered international endpoints and repeated transfer stops without moving their anchors', () => {
    const anchors = [{ id: 'origin', x: 290, y: 170 }, { id: 'destination', x: 295, y: 169 }, { id: 'transfer-1', x: 292, y: 171 }, { id: 'transfer-2', x: 292, y: 171 }].map(point => ({ ...point, width: 132, height: 42 }));
    const actual = placeAnnotations(anchors, { width: 560, height: 500 });
    expect(actual.map(({ id, x, y }) => ({ id, x, y }))).toEqual(anchors.map(({ id, x, y }) => ({ id, x, y })));
    for (let i = 0; i < actual.length; i++) for (let j = i + 1; j < actual.length; j++) {
      const a = actual[i]!, b = actual[j]!;
      expect(a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top).toBe(true);
    }
    expect(actual.some(item => item.leader !== null)).toBe(true);
    expect(placeAnnotations(anchors, { width: 560, height: 500 })).toEqual(actual);
  });

  it('keeps annotations inside a resized viewport when selected points touch its edges', () => {
    const anchors = [{ id: 'left', x: 1, y: 1 }, { id: 'right', x: 319, y: 219 }, { id: 'nearby', x: 318, y: 218 }].map(point => ({ ...point, width: 144, height: 42 }));
    for (const item of placeAnnotations(anchors, { width: 320, height: 220 })) {
      expect(item.left).toBeGreaterThanOrEqual(8); expect(item.top).toBeGreaterThanOrEqual(8);
      expect(item.left + item.width).toBeLessThanOrEqual(312); expect(item.top + item.height).toBeLessThanOrEqual(212);
    }
  });
});
