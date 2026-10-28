export type BloomStatus = 'unsupported' | 'warming' | 'trial' | 'enabled' | 'disabled';
export interface BloomBudgetSnapshot { status: BloomStatus; reason: string; frameP90: number | null; cpuP90: number | null; gpuP90: number | null; samples: number }
export const BLOOM_WARMUP_FRAMES = 24;
export const BLOOM_WINDOW_FRAMES = 90;
const p90 = (values: readonly number[]) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * .9) - 1]! : null;
/** Cadence is measured frame delivery, CPU is submission, and GPU is asynchronous timer-query time. */
export function createBloomBudget(supported: boolean, gpuTimerAvailable: boolean) {
  let status: BloomStatus = supported ? 'warming' : 'unsupported', reason = supported ? 'measuring-headroom' : 'unsupported-renderer';
  let warmup = BLOOM_WARMUP_FRAMES;
  let frames: number[] = [], cpu: number[] = [], gpu: { ms: number; at: number }[] = [];
  let activeMs = 0, phaseStartedMs = 0;
  const clear = () => { frames = []; cpu = []; gpu = []; warmup = BLOOM_WARMUP_FRAMES; phaseStartedMs = activeMs; };
  const snapshot = (): BloomBudgetSnapshot => ({ status, reason, frameP90: p90(frames), cpuP90: p90(cpu), gpuP90: p90(gpu.map(sample => sample.ms)), samples: frames.length });
  return {
    snapshot,
    rendering: () => status === 'trial' || status === 'enabled',
    measuring: () => warmup === 0 && status !== 'unsupported' && status !== 'disabled',
    suspend() { clear(); },
    fail(failure: string) { status = 'disabled'; reason = failure; clear(); },
    sample({ frameMs, cpuMs, gpuMs = [] }: { frameMs: number; cpuMs: number; gpuMs?: readonly number[] }) {
      if (status === 'unsupported' || status === 'disabled') return snapshot();
      if (!Number.isFinite(frameMs) || frameMs <= 0) return snapshot();
      activeMs += frameMs;
      if (status === 'trial' && activeMs - phaseStartedMs >= 5000) { status = 'disabled'; reason = 'trial-budget-timeout'; return snapshot(); }
      if (warmup > 0) { warmup--; if (warmup === 0 && status === 'warming') phaseStartedMs = activeMs; return snapshot(); }
      frames.push(frameMs); cpu.push(Math.max(0, cpuMs));
      gpu.push(...gpuMs.filter(value => Number.isFinite(value) && value >= 0).map(ms => ({ ms, at: activeMs })));
      frames = frames.slice(-BLOOM_WINDOW_FRAMES); cpu = cpu.slice(-BLOOM_WINDOW_FRAMES); gpu = gpu.filter(sample => activeMs - sample.at <= 2000).slice(-16);
      if (gpuTimerAvailable && gpu.length < 4) {
        if (status === 'enabled' && frames.length === BLOOM_WINDOW_FRAMES || activeMs - phaseStartedMs >= 5000) { status = 'disabled'; reason = 'gpu-timing-unavailable'; }
        return snapshot();
      }
      if (frames.length < BLOOM_WINDOW_FRAMES) return snapshot();
      const cadence = p90(frames)!, submission = p90(cpu)!, gpuCost = p90(gpu.map(sample => sample.ms));
      const healthy = cadence <= 23 && submission <= 8 && (gpuCost === null || gpuCost <= 10);
      if (!healthy) { reason = status === 'warming' ? 'insufficient-headroom' : 'budget-exceeded'; status = 'disabled'; }
      else if (status === 'warming') { status = 'trial'; reason = 'measuring-bloom'; clear(); }
      else if (status === 'trial') { status = 'enabled'; reason = gpuCost === null ? 'measured-cadence-and-submission' : 'measured-cadence-submission-and-gpu'; }
      return snapshot();
    },
  };
}

/** Bound both individual edges and total working pixels, independently of the shared canvas. */
export function bloomTargetSize(width: number, height: number, dpr: number) {
  const w = Math.max(1, width * dpr), h = Math.max(1, height * dpr);
  const scale = Math.min(1, 1024 / Math.max(w, h), Math.sqrt(786432 / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}
