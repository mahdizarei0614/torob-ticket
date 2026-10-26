import { describe, expect, it } from 'vitest';
import { chooseGraphicsQuality } from './quality-policy';
import { createRenderScheduler } from './render-scheduler';
import { createThemeUniforms, updateThemeUniforms, resolveTokenColor } from './theme-uniforms';
import { observeContextLifecycle } from './context-lifecycle';
describe('graphics quality budget', () => {
  it('bounds high density desktop/mobile pixels without claiming unmeasured performance', () => {
    expect(chooseGraphicsQuality({ deviceDpr: 3, mobile: false, samples: [] })).toEqual({ dpr: 1.75, tier: 'standard', reason: 'unmeasured' });
    expect(chooseGraphicsQuality({ deviceDpr: 3, mobile: true, samples: [] })).toEqual({ dpr: 1.5, tier: 'standard', reason: 'unmeasured' });
  });
  it('reduces workload only after a measured sustained expensive frame sample', () => {
    expect(chooseGraphicsQuality({ deviceDpr: 2, mobile: false, samples: Array(30).fill(40) })).toEqual({ dpr: 1, tier: 'low', reason: 'measured-cpu-submission' });
  });
});

describe('on-demand graphics scheduling', () => {
  it('coalesces changes, stops hidden motion, redraws on resume, and cancels disposal', () => {
    let sequence = 0;
    const pending = new Map<number, FrameRequestCallback>();
    let draws = 0;
    const scheduler = createRenderScheduler(() => draws++, { request: (callback) => { pending.set(++sequence, callback); return sequence; }, cancel: (id) => { pending.delete(id); }, now: () => 50 });
    scheduler.invalidate();
    scheduler.invalidate();
    expect(pending.size).toBe(1);
    const tick = () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(50)); };
    tick();
    expect(draws).toBe(1);
    expect(pending.size).toBe(0);
    scheduler.setPolicy({ active: true, motion: true, reducedMotion: false });
    tick();
    expect(draws).toBe(2);
    expect(pending.size).toBe(1);
    scheduler.setPolicy({ active: false, motion: true, reducedMotion: false });
    expect(pending.size).toBe(0);
    scheduler.invalidate();
    scheduler.flush();
    expect(draws).toBe(2);
    scheduler.setPolicy({ active: true, motion: true, reducedMotion: true });
    tick();
    expect(draws).toBe(3);
    expect(pending.size).toBe(0);
    scheduler.invalidate();
    scheduler.dispose();
    expect(pending.size).toBe(0);
  });
});
it('converts sRGB tokens to linear working colors once, preserving alpha', () => {
  expect(resolveTokenColor('#80808080')).toEqual({ r: expect.closeTo(0.215861, 5), g: expect.closeTo(0.215861, 5), b: expect.closeTo(0.215861, 5), a: expect.closeTo(128 / 255, 5) });
  expect(resolveTokenColor('rgba(255, 0, 0, 0.25)')).toEqual({ r: 1, g: 0, b: 0, a: 0.25 });
});

it('updates every shared theme vector without replacing uniform references', () => {
  const first = { background: '#808080', dot: '#808080', route: '#808080', routeMuted: '#808080', highlight: '#808080', chartLine: '#808080', chartGrid: '#808080', chartMarker: '#808080', priceLow: '#808080', priceMid: '#808080', priceHigh: '#808080', focus: '#808080' };
  const uniforms = createThemeUniforms(first);
  const vectors = Object.values(uniforms).map(uniform => uniform.value);
  updateThemeUniforms(uniforms, { background: '#ff0000', dot: '#ff0000', route: '#ff0000', routeMuted: '#ff0000', highlight: '#ff0000', chartLine: '#ff0000', chartGrid: '#ff0000', chartMarker: '#ff0000', priceLow: '#ff0000', priceMid: '#ff0000', priceHigh: '#ff0000', focus: '#ff0000' });
  Object.values(uniforms).forEach((uniform, index) => { expect(uniform.value).toBe(vectors[index]); expect(uniform.value.toArray()).toEqual([1, 0, 0, 1]); });
});
it('permits actual context restoration and disconnects both lifecycle listeners', () => {
  const canvas = document.createElement('canvas');
  let lost = 0;
  let restored = 0;
  const stop = observeContextLifecycle(canvas, () => lost++, () => restored++);
  const event = new Event('webglcontextlost', { cancelable: true });
  canvas.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  expect([lost, restored]).toEqual([1, 1]);
  stop();
  canvas.dispatchEvent(new Event('webglcontextlost'));
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  expect([lost, restored]).toEqual([1, 1]);
});
it('does not infer a slow tier from one compile outlier or a partial window', () => {
  expect(chooseGraphicsQuality({ deviceDpr: 2, mobile: false, samples: [150, ...Array(29).fill(2)] })?.tier).toBe('standard');
  expect(chooseGraphicsQuality({ deviceDpr: 2, mobile: false, samples: Array(29).fill(40) })?.tier).toBe('standard');
});
it('bridges scene invalidation once and prevents callback-driven loops without permitted motion', () => {
  let next = 0;
  const pending = new Map<number, FrameRequestCallback>();
  let draws = 0;
  const scheduler = createRenderScheduler(() => { draws++; scheduler.invalidateScene(); }, {
    request: callback => { pending.set(++next, callback); return next; },
    cancel: id => { pending.delete(id); }, now: () => 50,
  });
  const tick = () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(50)); };
  scheduler.invalidateScene();
  scheduler.invalidateScene();
  expect(pending.size).toBe(1);
  tick();
  expect(draws).toBe(1);
  expect(pending.size).toBe(0);
  scheduler.setPolicy({ active: true, motion: true, reducedMotion: true });
  tick();
  expect(pending.size).toBe(0);
  scheduler.setPolicy({ active: true, motion: true, reducedMotion: false });
  tick();
  expect(pending.size).toBe(1);
  scheduler.setPolicy({ active: false, motion: true, reducedMotion: false });
  scheduler.invalidateScene();
  expect(pending.size).toBe(0);
  scheduler.dispose();
});
