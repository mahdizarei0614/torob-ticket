import { describe, expect, it } from 'vitest';
import { bloomTargetSize, createBloomBudget } from './bloom-policy';
function frames(budget: ReturnType<typeof createBloomBudget>, count: number, frameMs = 16.7, cpuMs = 1, gpu: number | null = 2) {
  for (let index = 0; index < count; index++) budget.sample({ frameMs, cpuMs, gpuMs: gpu !== null && index % 12 === 0 ? [gpu] : [] });
}
function finishCooldown(budget: ReturnType<typeof createBloomBudget>) {
  const delay = budget.snapshot().retryInMs;
  expect(delay).not.toBeNull();
  budget.sample({ frameMs: delay! + 1, cpuMs: 1 });
  expect(budget.snapshot()).toMatchObject({ status: 'warming', reason: 'measuring-recovered-headroom', samples: 0, retryInMs: null });
}
function rejectBaseline(budget: ReturnType<typeof createBloomBudget>, frameMs = 50, cpuMs = 1.4, gpu = .75) {
  for (let frame = 0; frame < 240 && budget.snapshot().status === 'warming'; frame++) budget.sample({ frameMs, cpuMs, gpuMs: frame % 12 === 0 ? [gpu] : [] });
  expect(budget.snapshot().status).toBe('disabled');
}
describe('measured bloom budget', () => {
  it('requires steady headroom, a real effect trial and actual GPU samples when available', () => {
    const budget = createBloomBudget(true, true);
    frames(budget, 113); expect(budget.snapshot().status).toBe('warming'); expect(budget.rendering()).toBe(false);
    frames(budget, 1); expect(budget.snapshot().status).toBe('trial'); expect(budget.rendering()).toBe(true);
    frames(budget, 114); expect(budget.snapshot()).toMatchObject({ status: 'enabled', gpuP90: 2, reason: 'measured-cadence-submission-and-gpu', limitingFactor: null, recoveryCount: 0, retryInMs: null });
  });
  it.each([33.3,8.3])('qualifies stable native%s ms delivery only after a real effect trial', period => {
    const budget = createBloomBudget(true, true);frames(budget, 113, period);
    expect(budget.snapshot()).toMatchObject({ status: 'warming', frameP50: period, cadenceReferenceMs: null });expect(budget.rendering()).toBe(false);
    frames(budget, 1, period);expect(budget.snapshot()).toMatchObject({ status: 'trial', cadenceReferenceMs: period });expect(budget.snapshot().cadenceLimitMs).toBeCloseTo(period + Math.max(2.5, period * .1));
    frames(budget, 113, period);expect(budget.snapshot().status).toBe('trial');
    frames(budget, 1, period);expect(budget.snapshot()).toMatchObject({ status: 'enabled', frameP50: period, frameP90: period, cadenceReferenceMs: period });
  });
  it.each([{ baseline: 16.7, effect: 33.3 },{ baseline: 8.3, effect: 16.7 }])('does not rebase a $baseline ms native cadence to a slower $effect ms effect', ({ baseline, effect }) => {
    const budget = createBloomBudget(true, true);frames(budget, 114, baseline);frames(budget, 114, effect);
    expect(budget.snapshot()).toMatchObject({ status: 'disabled', reason: 'budget-exceeded', limitingFactor: 'cadence', cadenceReferenceMs: baseline,
      lastFailure: { frameP50: effect, cadenceReferenceMs: baseline } });
    expect(budget.snapshot().cadenceLimitMs).toBeCloseTo(baseline + Math.max(2.5, baseline * .1));expect(budget.rendering()).toBe(false);
  });
  it('rejects a30Hz trial that regresses to mixed20/30Hz even with spare CPU and GPU', () => {
    const budget = createBloomBudget(true, true);frames(budget, 114, 33.3);
    for (let frame = 0; frame < 114; frame++) budget.sample({ frameMs: frame % 2 ? 50 : 33.3, cpuMs: 1, gpuMs: frame % 12 === 0 ? [2] : [] });
    expect(budget.snapshot()).toMatchObject({ status: 'disabled', reason: 'budget-exceeded', limitingFactor: 'cadence', cadenceReferenceMs: 33.3,
      lastFailure: { frameP90: 50, cadenceReferenceMs: 33.3 } });expect(budget.rendering()).toBe(false);
  });
  it('bounds a stable20Hz effect trial without weakening its approved30Hz reference', () => {
    const budget = createBloomBudget(true, true);frames(budget, 114, 33.3);frames(budget, 114, 50);
    expect(budget.snapshot()).toMatchObject({ status: 'disabled', reason: 'trial-budget-timeout', cadenceReferenceMs: 33.3,
      lastFailure: { cadenceReferenceMs: 33.3 } });expect(budget.rendering()).toBe(false);
  });
  it('rejects an unstable baseline instead of using a slow p90 as the reference', () => {
    const budget = createBloomBudget(true, true);
    for (let frame = 0; frame < 114; frame++) budget.sample({ frameMs: frame % 5 ? 16.7 : 33.3, cpuMs: 1, gpuMs: frame % 12 === 0 ? [2] : [] });
    expect(budget.snapshot()).toMatchObject({ status: 'disabled', limitingFactor: 'cadence', frameP50: 16.7, frameP90: 33.3, cadenceReferenceMs: null });expect(budget.rendering()).toBe(false);
  });
  it('keeps CPU8ms and GPU10ms as independent boundaries even on native30Hz delivery', () => {
    for (const { cpuMs, gpu, status } of [{ cpuMs: 8, gpu: 10, status: 'enabled' },{ cpuMs: 8.01, gpu: 10, status: 'disabled' },{ cpuMs: 8, gpu: 10.01, status: 'disabled' }]) {
      const budget = createBloomBudget(true, true);frames(budget, 228, 33.3, cpuMs, gpu);expect(budget.snapshot().status).toBe(status);
      expect(budget.snapshot().cadenceReferenceMs).toBe(status === 'enabled' ? 33.3 : null);
    }
  });
  it('tightens enabled cadence only after the faster full window also fits its own p90 guard', () => {
    const budget = createBloomBudget(true, true);frames(budget, 228, 33.3);frames(budget, 80, 16.7);
    expect(budget.snapshot()).toMatchObject({ status: 'enabled', frameP50: 16.7, frameP90: 33.3, cadenceReferenceMs: 33.3 });
    frames(budget, 10, 16.7);expect(budget.snapshot()).toMatchObject({ status: 'enabled', frameP50: 16.7, frameP90: 16.7, cadenceReferenceMs: 16.7 });expect(budget.snapshot().cadenceLimitMs).toBeCloseTo(19.2);
  });
  it('loosens cadence only through cooldown, healthy recovered baseline and another real trial', () => {
    const budget = createBloomBudget(true, true);frames(budget, 228);frames(budget, 90, 33.3);
    expect(budget.snapshot()).toMatchObject({ status: 'disabled', cadenceReferenceMs: 16.7, lastFailure: { cadenceReferenceMs: 16.7 } });
    finishCooldown(budget);expect(budget.snapshot().cadenceReferenceMs).toBeNull();
    frames(budget, 24 + 180, 33.3);expect(budget.snapshot()).toMatchObject({ status: 'trial', cadenceReferenceMs: 33.3 });
    frames(budget, 114, 33.3);expect(budget.snapshot()).toMatchObject({ status: 'enabled', cadenceReferenceMs: 33.3 });
  });
  it('retains approved cadence through suspension and trial shader warmup', () => {
    const budget = createBloomBudget(true, true);frames(budget, 114);budget.suspend();
    expect(budget.snapshot()).toMatchObject({ status: 'trial', cadenceReferenceMs: 16.7 });
    frames(budget, 1, 200, 100, 100);frames(budget, 23);frames(budget, 90);
    expect(budget.snapshot()).toMatchObject({ status: 'enabled', cadenceReferenceMs: 16.7 });budget.suspend();expect(budget.snapshot().cadenceReferenceMs).toBe(16.7);
  });
  it.each([{ baseline: 16.7, effect: 33.3 },{ baseline: 33.3, effect: 50 }])('bounds repeated effect-only overload for120active seconds at $baseline/$effect ms', ({ baseline, effect }) => {
    const budget = createBloomBudget(true, true), trials: number[] = [];let activeMs = 0;
    for (let frame = 0; activeMs < 120000; frame++) {
      const before = budget.snapshot().status, frameMs = budget.rendering() ? effect : baseline;activeMs += frameMs;
      const after = budget.sample({ frameMs, cpuMs: 1, gpuMs: frame % 12 === 0 ? [2] : [] });
      expect(after.status).not.toBe('enabled');
      if (after.status === 'warming' || after.status === 'disabled') expect(budget.rendering()).toBe(false);
      if (after.status === 'trial' && before !== 'trial') trials.push(activeMs);
    }
    expect(trials.length).toBeGreaterThan(1);expect(trials.length).toBeLessThanOrEqual(5);
    for (let attempt = 1; attempt < trials.length; attempt++) expect(trials[attempt]! - trials[attempt - 1]!).toBeGreaterThanOrEqual(5000 + 180 * baseline);
    expect(budget.snapshot().lastFailure?.cadenceReferenceMs).toBe(baseline);
  });
  it.each([
    { frameMs: 50, cpuMs: 1.4, gpu: .75, limitingFactor: 'cadence' },
    { frameMs: 16.7, cpuMs: 9, gpu: 2, limitingFactor: 'cpu' },
    { frameMs: 16.7, cpuMs: 1, gpu: 11, limitingFactor: 'gpu' },
  ])('reports the actual $limitingFactor limit without weakening other budgets', ({ frameMs, cpuMs, gpu, limitingFactor }) => {
    const budget = createBloomBudget(true, true);rejectBaseline(budget, frameMs, cpuMs, gpu);
    expect(budget.snapshot()).toMatchObject({ status: 'disabled', reason: 'insufficient-headroom', frameP50: frameMs, frameP90: frameMs, cpuP90: cpuMs, gpuP90: gpu, limitingFactor, samples: 90, retryInMs: 5000, cadenceReferenceMs: null, cadenceLimitMs: null });
    expect(budget.rendering()).toBe(false);
  });
  it('ignores shader warmup before measuring either baseline or effect', () => {
    const budget = createBloomBudget(true, true);
    frames(budget, 1, 200, 100, 100); frames(budget, 23); frames(budget, 90);
    expect(budget.snapshot().status).toBe('trial');
    frames(budget, 1, 200, 100, 100); frames(budget, 23); frames(budget, 90); expect(budget.snapshot().status).toBe('enabled');
  });
  it('recovers temporary startup rejection only after cooldown, a longer healthy baseline and a real effect trial', () => {
    const budget = createBloomBudget(true, true);rejectBaseline(budget);
    const failure = budget.snapshot().lastFailure;
    budget.sample({ frameMs: 4999, cpuMs: 1 });
    expect(budget.snapshot()).toMatchObject({ status: 'disabled', retryInMs: 1, frameP50: 50, frameP90: 50, samples: 90, recoveryCount: 0 });
    expect(budget.snapshot().lastFailure).toEqual(failure);expect(budget.rendering()).toBe(false);
    budget.sample({ frameMs: 1, cpuMs: 1 });
    expect(budget.snapshot()).toMatchObject({ status: 'warming', samples: 0, recoveryCount: 1, limitingFactor: null, retryInMs: null });
    frames(budget, 24 + 179);expect(budget.snapshot().status).toBe('warming');expect(budget.rendering()).toBe(false);
    frames(budget, 1);expect(budget.snapshot().status).toBe('trial');expect(budget.rendering()).toBe(true);
    frames(budget, 113);expect(budget.snapshot().status).toBe('trial');
    frames(budget, 1);expect(budget.snapshot()).toMatchObject({ status: 'enabled', recoveryCount: 1, retryInMs: null });
    expect(budget.snapshot().lastFailure).toEqual(failure);
  });
  it('backs off repeated incapable workloads without ever rendering an effect trial', () => {
    const budget = createBloomBudget(true, true);rejectBaseline(budget, 16.7, 9);
    for (const [attempt, delay] of [5000, 10000, 20000, 30000, 30000].entries()) {
      expect(budget.snapshot()).toMatchObject({ status: 'disabled', recoveryCount: attempt, limitingFactor: 'cpu' });expect(budget.snapshot().retryInMs).toBeCloseTo(delay, 5);
      finishCooldown(budget);
      for (let frame = 0; frame < 24 + 180; frame++) {
        budget.sample({ frameMs: 16.7, cpuMs: 9, gpuMs: frame % 12 === 0 ? [.75] : [] });
        expect(budget.rendering()).toBe(false);
      }
    }
    expect(budget.snapshot()).toMatchObject({ status: 'disabled', recoveryCount: 5 });expect(budget.snapshot().retryInMs).toBeCloseTo(30000, 5);
  });
  it('degrades sustained enabled load and requires stable requalification before enabling again', () => {
    const budget = createBloomBudget(true, true);frames(budget, 228);
    const load = () => { for (let frame = 0; frame < 90 && budget.snapshot().status === 'enabled'; frame++) budget.sample({ frameMs: 40, cpuMs: 12, gpuMs: frame % 12 === 0 ? [2] : [] }); };
    load();
    expect(budget.snapshot()).toMatchObject({ status: 'disabled', reason: 'budget-exceeded', limitingFactor: 'cadence' });expect(budget.snapshot().retryInMs).toBeCloseTo(5000, 5);
    finishCooldown(budget);frames(budget, 24 + 180);expect(budget.snapshot().status).toBe('trial');
    frames(budget, 114);expect(budget.snapshot()).toMatchObject({ status: 'enabled', recoveryCount: 1 });
    load();expect(budget.snapshot().status).toBe('disabled');expect(budget.snapshot().retryInMs).toBeCloseTo(10000, 5);
  });
  it('does not count suspended time or invalid resume deltas toward cooldown or healthy windows', () => {
    const budget = createBloomBudget(true, true);rejectBaseline(budget);
    const failure = budget.snapshot();budget.suspend();budget.suspend();
    for (const frameMs of [0, -1, NaN, Infinity]) budget.sample({ frameMs, cpuMs: 1, gpuMs: [1] });
    expect(budget.snapshot()).toBe(failure);
    finishCooldown(budget);frames(budget, 100);budget.suspend();
    expect(budget.snapshot()).toMatchObject({ status: 'warming', samples: 0, recoveryCount: 1 });
    frames(budget, 24 + 179);expect(budget.snapshot().status).toBe('warming');frames(budget, 1);expect(budget.snapshot().status).toBe('trial');
  });
  it('does not mix suspended intervals into initial qualification', () => {
    const budget = createBloomBudget(true, false); frames(budget, 60); budget.suspend(); frames(budget, 60);
    expect(budget.snapshot().status).toBe('warming'); frames(budget, 54); expect(budget.snapshot().status).toBe('trial');
  });
  it('uses conservative cadence/submission qualification if timer queries are unavailable', () => {
    const budget = createBloomBudget(true, false); frames(budget, 228);
    expect(budget.snapshot()).toMatchObject({ status: 'enabled', gpuP90: null, reason: 'measured-cadence-and-submission' });
  });
  it.each(['effect-unavailable','low-quality-tier'])('keeps explicit %s failure terminal instead of retrying allocation', failure => {
    const budget = createBloomBudget(true, true);frames(budget, 228);budget.fail(failure);
    const failed = budget.snapshot();expect(failed).toMatchObject({ status: 'disabled', reason: failure, retryInMs: null });
    frames(budget, 2000);budget.suspend();frames(budget, 2000);
    expect(budget.snapshot()).toBe(failed);expect(budget.rendering()).toBe(false);expect(budget.measuring()).toBe(false);
  });
  it('never retries unsupported hardware', () => {
    const budget = createBloomBudget(false, false);frames(budget, 2000);budget.suspend();budget.fail('low-quality-tier');frames(budget, 2000);
    expect(budget.snapshot()).toMatchObject({ status: 'unsupported', limitingFactor: 'capability', retryInMs: null, recoveryCount: 0 });expect(budget.rendering()).toBe(false);
  });
  it('requires recent sparse GPU results and can remeasure after timing becomes available', () => {
    const budget = createBloomBudget(true, true);frames(budget, 228 + 400);expect(budget.snapshot().status).toBe('enabled');
    frames(budget, 120, 16.7, 1, null);
    expect(budget.snapshot()).toMatchObject({ status: 'disabled', reason: 'gpu-timing-unavailable', limitingFactor: 'gpu-timing' });
    finishCooldown(budget);frames(budget, 24 + 180);expect(budget.snapshot().status).toBe('trial');frames(budget, 114);expect(budget.snapshot().status).toBe('enabled');
  });
  it('bounds a real trial and never treats missing GPU evidence as success', () => {
    const timeout = createBloomBudget(true, true);frames(timeout, 114);timeout.sample({ frameMs: 5000, cpuMs: 1 });
    expect(timeout.snapshot()).toMatchObject({ status: 'disabled', reason: 'trial-budget-timeout', limitingFactor: 'trial-timeout' });expect(timeout.snapshot().retryInMs).toBeCloseTo(5000, 5);
    const missing = createBloomBudget(true, true);frames(missing, 24 + 300, 16.7, 1, null);
    expect(missing.snapshot()).toMatchObject({ status: 'disabled', reason: 'gpu-timing-unavailable', limitingFactor: 'gpu-timing' });expect(missing.rendering()).toBe(false);
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
it('does not multiply soft-glow source pixels at HiDPI while retaining its aspect and target bounds', () => {
  for (const [width, height] of [[580,634],[1366,768]]) {
    const cssTarget = bloomTargetSize(width!,height!,1);
    for (const dpr of [1.75,2,3]) {
      const target = bloomTargetSize(width!,height!,dpr);
      expect(target).toEqual(cssTarget);expect(target.width).toBeLessThanOrEqual(width!);expect(target.height).toBeLessThanOrEqual(height!);
      expect(target.width / target.height).toBeCloseTo(width! / height!,2);
      expect(Math.max(target.width,target.height)).toBeLessThanOrEqual(1024);expect(target.width * target.height).toBeLessThanOrEqual(786432);
    }
  }
});
