import { randomUUID } from 'node:crypto';
import { MappingPatchSchema, ProviderOverridePatchSchema } from '@torob-ticket/contracts';
import { cleanAlias, type AliasMapping, type RealClock } from '@torob-ticket/domain';
import { catalogForIdentity } from '@torob-ticket/fixtures';
import { RepositoryError, type ProviderContextSnapshot, type SearchRepository } from '@torob-ticket/data-access';
import type { ProviderContext } from '@torob-ticket/provider-adapters';
import type { SessionContext } from '../sessions/session-context';
import { FrozenDemoClock } from '../common/clocks';
/** Internal composition only. T09 supplies a server-owned run and cancellation. */
export class ProviderService {
  constructor(private readonly getRepository:()=>SearchRepository,private readonly realClock:RealClock) {}
  async createContext(session:SessionContext,searchId:string,signal:AbortSignal,deadline:Date,frozen?:ProviderContextSnapshot):Promise<ProviderContext> {
    if(session.scope.sessionId!==session.sessionId) throw new RepositoryError('NOT_FOUND');
    const snapshot=frozen??await this.getRepository().providerContextSnapshot(session.scope,searchId);
    const info=snapshot.info;
    const aliases:AliasMapping[]=[{entityType:'city',sourceNamespace:'demo-provider-03/v1',sourceValue:'Istanbul / استانبول',targetId:'istanbul'}];
    for(const raw of snapshot.mappings) {
      if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).length===0) continue;
      const patch=MappingPatchSchema.parse(raw);
      const same=(m:AliasMapping)=>m.entityType===patch.entityType&&m.sourceNamespace===patch.sourceNamespace&&cleanAlias(m.sourceValue)===cleanAlias(patch.sourceValue);
      // A descendant replaces that namespace/entity alias decision, never history.
      for(let i=aliases.length-1;i>=0;i--) if(same(aliases[i]!)) aliases.splice(i,1);
      aliases.push(patch);
    }
    return {operationId:randomUUID(),fixtureVersion:info.fixtureVersion,seed:info.seed,scenario:info.scenario,scenarioRevision:info.scenarioRevision,mappingRevision:info.mappingRevision,demoClock:new FrozenDemoClock(info.anchorInstant),realClock:this.realClock,signal,deadline:new Date(deadline),catalog:catalogForIdentity(info.fixtureVersion,info.catalogRevision),aliases,overrides:Object.fromEntries(snapshot.overrides.map(row=>[row.providerId,ProviderOverridePatchSchema.parse(row.payload)])),traceSink:evidence=>this.getRepository().appendNormalizationEvidence(session.scope,{searchId,...evidence})};
  }
}
