import { describe, expect, it } from 'vitest';
import { bloomTargetSize, createBloomBudget } from './bloom-policy';
function frames(budget: ReturnType<typeof createBloomBudget>, count: number, frameMs = 16.7, cpuMs = 1, gpu = 2) {
  for (let index = 0; index < count; index++) budget.sample({ frameMs, cpuMs, gpuMs: index % 12 === 0 ? [gpu] : [] });
}
describe('measured bloom budget', () => {
  it('requires steady headroom, a real effect trial and actual GPU samples when available', () => {
    const budget = createBloomBudget(true, true);
    frames(budget, 113); expect(budget.snapshot().status).toBe('warming'); expect(budget.rendering()).toBe(false);
    frames(budget, 1); expect(budget.snapshot().status).toBe('trial'); expect(budget.rendering()).toBe(true);
    frames(budget, 114); expect(budget.snapshot()).toMatchObject({ status: 'enabled', gpuP90: 2, reason: 'measured-cadence-submission-and-gpu' });
  });
  it('never qualifies on fast CPU submission when actual frame delivery or GPU is expensive', () => {
    for (const [cadence, gpu] of [[33.3, 2], [16.7, 14]]) {
      const budget = createBloomBudget(true, true); frames(budget, 114, cadence, .2, gpu);
      expect(budget.snapshot()).toMatchObject({ status: 'disabled', reason: 'insufficient-headroom' });
      frames(budget, 300); expect(budget.rendering()).toBe(false);
    }
  });
  it('ignores shader warmup, then degrades on sustained load without oscillating back', () => {
    const budget = createBloomBudget(true, true);
    frames(budget, 1, 200, 100, 100); frames(budget, 23); frames(budget, 90);
    expect(budget.snapshot().status).toBe('trial');
    frames(budget, 1, 200, 100, 100); frames(budget, 23); frames(budget, 90); expect(budget.snapshot().status).toBe('enabled');
    frames(budget, 90, 40, 12, 16); expect(budget.snapshot()).toMatchObject({ status: 'disabled', reason: 'budget-exceeded' });
    frames(budget, 300); expect(budget.snapshot().status).toBe('disabled');
  });
  it('does not mix suspended intervals or unsupported hardware into a successful measurement', () => {
    const budget = createBloomBudget(true, false); frames(budget, 60); budget.suspend(); frames(budget, 60);
    expect(budget.snapshot().status).toBe('warming'); frames(budget, 54); expect(budget.snapshot().status).toBe('trial');
    const unsupported = createBloomBudget(false, false); frames(unsupported, 400); expect(unsupported.snapshot().status).toBe('unsupported');
  });
  it('uses conservative cadence/submission qualification if timer queries are unavailable', () => {
    const budget = createBloomBudget(true, false); frames(budget, 228);
    expect(budget.snapshot().status).toBe('enabled'); budget.fail('effect-unavailable'); expect(budget.rendering()).toBe(false);
  });
});
it('caps local targets without changing the shared viewport or canvas', () => {
  for (const [width, height, dpr] of [[600, 634, 1.75], [8000, 4000, 3], [320, 400, 1]]) {
    const target = bloomTargetSize(width!, height!, dpr!);
    expect(Math.max(target.width, target.height)).toBeLessThanOrEqual(1024);
    expect(target.width * target.height).toBeLessThanOrEqual(786432);
    expect(target.width / target.height).toBeCloseTo(width! / height!, 2);
  }
});
