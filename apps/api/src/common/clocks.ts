import type { DemoClock, RealClock } from '@torob-ticket/domain';
export class SystemRealClock implements RealClock { now(): Date { return new Date(); } }
export class FrozenDemoClock implements DemoClock {
  constructor(private readonly anchorInstant: string) {}
  now(): Date { return new Date(this.anchorInstant); }
}
