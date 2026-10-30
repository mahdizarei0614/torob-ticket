import type { DemoScenario, TransportSearchQuery } from '@torob-ticket/contracts';
export interface FixtureQuery {
  fixtureVersion:string; seed:number; anchorInstant:string; scenario:DemoScenario; scenarioRevision:string; mappingRevision:string;
  /** Explicit transport revision; absence reproduces the immutable original source. */
  sourceRevision?:string;
  query:TransportSearchQuery;
  /** Recheck is a deterministic data phase; runtime scheduling belongs to T06. */
  phase?:'search'|'recheck';
  caseId?:'airport-change'|'incomplete-round-trip'|'ambiguous-unit'|'technical-stop'|'duplicate'|'discontinuous-price'|'no-timetable'|'unknown-fees'|'limited-stock';
}
