/** Frozen schedule anchor. Callers receive a new Date, never mutable clock state. */
export interface DemoClock { now(): Date }
/** Wall clock for audit timestamps, deadlines, inactivity and quote/intent expiry. */
export interface RealClock { now(): Date }
