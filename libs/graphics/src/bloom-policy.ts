export type BloomStatus = 'unsupported' | 'warming' | 'trial' | 'enabled' | 'disabled';
export type BloomLimitingFactor = 'cadence' | 'cpu' | 'gpu' | 'gpu-timing' | 'trial-timeout' | 'capability' | 'effect' | 'quality';
interface BloomWindow { frameP50: number | null; frameP90: number | null; cpuP90: number | null; gpuP90: number | null; samples: number }
export interface BloomBudgetSnapshot extends BloomWindow {
  status: BloomStatus; reason: string; limitingFactor: BloomLimitingFactor | null;
  retryInMs: number | null; recoveryCount: number;
  cadenceReferenceMs: number | null; cadenceLimitMs: number | null;
  lastFailure: (BloomWindow & { reason: string; limitingFactor: BloomLimitingFactor; cadenceReferenceMs: number | null; cadenceLimitMs: number | null }) | null;
}
export const BLOOM_WARMUP_FRAMES = 24;
export const BLOOM_WINDOW_FRAMES = 90;
export const BLOOM_RECOVERY_WINDOW_FRAMES = 180;
const p90 = (values: readonly number[]) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * .9) - 1]! : null;
const cadenceGuard = (reference: number) => reference + Math.max(2.5, reference * .1);
/** Cadence is measured frame delivery, CPU is submission, and GPU is asynchronous timer-query time. */
export function createBloomBudget(supported: boolean, gpuTimerAvailable: boolean) {
  let status: BloomStatus = supported ? 'warming' : 'unsupported', reason = supported ? 'measuring-headroom' : 'unsupported-renderer';
  let warmup = BLOOM_WARMUP_FRAMES, suspended = false, terminal = !supported;
  let frames: number[] = [], cpu: number[] = [], gpu: { ms: number; at: number }[] = [];
  let activeMs = 0, phaseStartedMs = 0;
  let frameP50: number | null = null, frameP90: number | null = null, cpuP90: number | null = null, gpuP90: number | null = null;
  let cadenceReferenceMs: number | null = null, cadenceLimitMs: number | null = null;
  let limitingFactor: BloomLimitingFactor | null = supported ? null : 'capability';
  let retryAtMs: number | null = null, recoveryCount = 0;
  let lastFailure: BloomBudgetSnapshot['lastFailure'] = null;
  const makeSnapshot = (): BloomBudgetSnapshot => Object.freeze({ status, reason, frameP50, frameP90, cpuP90, gpuP90, samples: frames.length, limitingFactor,
    retryInMs: retryAtMs === null ? null : Math.max(0, retryAtMs - activeMs), recoveryCount, cadenceReferenceMs, cadenceLimitMs, lastFailure });
  let cached = makeSnapshot();
  const publish = () => (cached = makeSnapshot());
  const clear = (resetReference = false) => {
    frames = []; cpu = []; gpu = [];frameP50 = frameP90 = cpuP90 = gpuP90 = null;
    if (resetReference) cadenceReferenceMs = cadenceLimitMs = null;
    warmup = BLOOM_WARMUP_FRAMES;phaseStartedMs = activeMs;
  };
  const recordFailure = (failure: string, factor: BloomLimitingFactor) => {
    status = 'disabled';reason = failure;limitingFactor = factor;
    lastFailure = Object.freeze({ reason, limitingFactor: factor, frameP50, frameP90, cpuP90, gpuP90, samples: frames.length, cadenceReferenceMs, cadenceLimitMs });
  };
  const reject = (failure: string, factor: BloomLimitingFactor) => {
    recordFailure(failure, factor);
    // Keep the failed window while the ordinary map runs. No effect resources or
    // extra frames are needed to wait; only permitted active samples count.
    retryAtMs = activeMs + Math.min(30000, 5000 * 2 ** Math.min(recoveryCount, 3));
  };
  const windowLimit = () => {
    // Native delivery can be capped at30Hz by the OS while CPU/GPU have ample
    // headroom. A stable approximately30Hz-or-faster baseline may qualify, but
    // the live effect must not normalize a slower cadence into a new baseline.
    const reference = status === 'warming' ? frameP50! : cadenceReferenceMs!;
    const cadenceRatio = Math.max(frameP90! / cadenceGuard(reference), status === 'warming' ? reference / 34.5 : 0);
    const ratios: [BloomLimitingFactor, number][] = [['cadence', cadenceRatio], ['cpu', cpuP90! / 8]];
    if (gpuTimerAvailable && gpuP90 !== null) ratios.push(['gpu', gpuP90 / 10]);
    return ratios.reduce<[BloomLimitingFactor | null, number]>((worst, [factor, ratio]) => ratio > worst[1] ? [factor, ratio] : worst, [null, 1])[0];
  };
  return {
    snapshot: () => cached,
    rendering: () => !suspended && (status === 'trial' || status === 'enabled'),
    measuring: () => !suspended && warmup === 0 && status !== 'unsupported' && status !== 'disabled',
    suspend() {
      if (suspended) return cached;
      suspended = true;
      // A paused cooldown retains its remaining active time and failed evidence.
      if (status === 'disabled' || status === 'unsupported') return cached;
      clear();return publish();
    },
    fail(failure: string) {
      if (status === 'unsupported' || terminal && reason === failure) return cached;
      terminal = true;retryAtMs = null;
      recordFailure(failure, failure === 'low-quality-tier' ? 'quality' : 'effect');
      return publish();
    },
    sample({ frameMs, cpuMs, gpuMs = [] }: { frameMs: number; cpuMs: number; gpuMs?: readonly number[] }) {
      if (terminal || !Number.isFinite(frameMs) || frameMs <= 0) return cached;
      suspended = false;
      activeMs += frameMs;
      if (status === 'disabled') {
        if (retryAtMs !== null && activeMs >= retryAtMs) {
          recoveryCount++;retryAtMs = null;status = 'warming';reason = 'measuring-recovered-headroom';limitingFactor = null;clear(true);
        }
        return publish();
      }
      while (gpu.length && activeMs - gpu[0]!.at > 2000) gpu.shift();
      if (status === 'trial' && activeMs - phaseStartedMs >= 5000) {
        gpuP90 = p90(gpu.map(sample => sample.ms));reject('trial-budget-timeout', 'trial-timeout');return publish();
      }
      if (warmup > 0) { warmup--; if (warmup === 0 && status === 'warming') phaseStartedMs = activeMs; return publish(); }
      const size = status === 'warming' && recoveryCount > 0 ? BLOOM_RECOVERY_WINDOW_FRAMES : BLOOM_WINDOW_FRAMES;
      frames.push(frameMs);cpu.push(Number.isFinite(cpuMs) ? Math.max(0, cpuMs) : Infinity);
      if (frames.length > size) { frames.shift();cpu.shift(); }
      if (gpuTimerAvailable) gpu.push(...gpuMs.filter(value => Number.isFinite(value) && value >= 0).map(ms => ({ ms, at: activeMs })));
      if (gpu.length > 16) gpu.splice(0, gpu.length - 16);
      // Compute percentiles once per accepted sample. Consumers may inspect this
      // cached immutable snapshot repeatedly without sorting the same windows.
      const orderedFrames = [...frames].sort((a, b) => a - b), middle = Math.floor(orderedFrames.length / 2);
      frameP50 = orderedFrames.length % 2 ? orderedFrames[middle]! : (orderedFrames[middle - 1]! + orderedFrames[middle]!) / 2;
      frameP90 = orderedFrames[Math.ceil(orderedFrames.length * .9) - 1]!;cpuP90 = p90(cpu);gpuP90 = p90(gpu.map(sample => sample.ms));
      if (gpuTimerAvailable && gpu.length < 4) {
        if (status === 'enabled' && frames.length === size || activeMs - phaseStartedMs >= 5000) reject('gpu-timing-unavailable', 'gpu-timing');
        return publish();
      }
      if (frames.length < size) return publish();
      const limit = windowLimit();
      if (limit) reject(status === 'warming' ? 'insufficient-headroom' : 'budget-exceeded', limit);
      else if (status === 'warming') {
        cadenceReferenceMs = frameP50;cadenceLimitMs = cadenceGuard(cadenceReferenceMs!);
        status = 'trial';reason = 'measuring-bloom';clear();
      }
      else if (status === 'trial') { status = 'enabled'; reason = gpuTimerAvailable ? 'measured-cadence-submission-and-gpu' : 'measured-cadence-and-submission'; }
      else if (frameP50! < cadenceReferenceMs! && frameP90! <= cadenceGuard(frameP50!)) {
        // Tighten only when the whole healthy window fits the faster guard.
        // A mixed speed-up window must not immediately reject its old samples.
        cadenceReferenceMs = frameP50;cadenceLimitMs = cadenceGuard(cadenceReferenceMs!);
      }
      return publish();
    },
  };
}

/** Soft glow uses at most one sample per CSS pixel; the sharp base keeps its own DPR. */
export function bloomTargetSize(width: number, height: number, dpr: number) {
  const density = Number.isFinite(dpr) && dpr > 0 ? Math.min(1, dpr) : 1;
  const w = Math.max(1, width * density), h = Math.max(1, height * density);
  const scale = Math.min(1, 1024 / Math.max(w, h), Math.sqrt(786432 / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}
