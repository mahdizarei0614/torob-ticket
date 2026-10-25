export interface GraphicsQuality {
  dpr: number;
  tier: 'standard' | 'low';
  reason: 'unmeasured' | 'measured-cpu-submission';
}
/** CPU submission time is a conservative workload heuristic, not a GPU/FPS measurement. */
export function chooseGraphicsQuality({ deviceDpr, mobile, samples }: { deviceDpr: number; mobile: boolean; samples: readonly number[] }): GraphicsQuality {
  const measured = samples.filter(value => Number.isFinite(value) && value >= 0).slice(-30).sort((a, b) => a - b);
  const expensive = measured.length === 30 && (measured[14] ?? 0) > 24;
  return { dpr: Math.min(Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1, expensive ? 1 : mobile ? 1.5 : 1.75), tier: expensive ? 'low' : 'standard', reason: expensive ? 'measured-cpu-submission' : 'unmeasured' };
}
