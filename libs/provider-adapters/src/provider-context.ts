import type { CatalogSnapshot, DemoScenario, ProviderOverridePatch, RawProviderRecord } from '@torob-ticket/contracts';
import type { AliasMapping, DemoClock, NormalizationResult, RealClock } from '@torob-ticket/domain';
import type { FixtureQuery, ScenarioSettings } from '@torob-ticket/fixtures';
export interface ProviderEvidence extends NormalizationResult { raw:RawProviderRecord; sourceRawRecordId:string }
export interface ProviderTraceBatchSink {
  (this:ProviderContext,evidence:readonly ProviderEvidence[],assertActive:()=>void):Promise<void>;
  /** Receiver-aware availability keeps copied contexts with custom row hooks on fallback. */
  isAvailable?:(context:ProviderContext)=>boolean;
}
export interface ProviderContext {
  operationId:string;
  fixtureVersion:string;
  /** Selected source versions are independent of the catalog/root version. */
  sourceRevisions?:Readonly<Record<string,string>>;
  seed:number;
  scenario:DemoScenario;
  scenarioRevision:string;
  mappingRevision:string;
  demoClock:DemoClock;
  realClock:RealClock;
  signal:AbortSignal;
  deadline:Date;
  catalog:CatalogSnapshot;
  aliases:readonly AliasMapping[];
  overrides:Readonly<Record<string,ProviderOverridePatch>>;
  settings?:ScenarioSettings;
  caseId?:FixtureQuery['caseId'];
  traceSink:(evidence:ProviderEvidence)=>Promise<void>;
  /** Optional atomic provider/date append. The guard also fences a queued storage write. */
  traceBatchSink?:ProviderTraceBatchSink;
}
