import {Inject,Injectable} from '@nestjs/common';
import {ProviderTrafficRepository,TrafficActivityRepository,trafficActivityPlan,RepositoryError} from '@torob-ticket/data-access';
import {catalogForIdentity} from '@torob-ticket/fixtures';
import type {SessionInfo,TrafficQuery,UpdateProviderTariff} from '@torob-ticket/contracts';
import type {DataScope} from '@torob-ticket/data-access';
import {trafficActivitySources} from './traffic-activity-sources';
import {SessionService} from '../sessions/session.service';
import type {SessionContext} from '../sessions/session-context';
@Injectable()
export class ProviderTrafficService {
 constructor(@Inject(SessionService)private readonly sessions:SessionService){}
 private get repository(){return new ProviderTrafficRepository(this.sessions.database);}
 private providers(s:SessionContext){return catalogForIdentity(s.info.fixtureVersion,s.info.catalogRevision).providerCapabilities.map(p=>p.providerId);}
 async list(s:SessionContext,q:TrafficQuery){const ids=this.providers(s);if(q.providerId&&!ids.includes(q.providerId))throw new RepositoryError('NOT_FOUND');return this.repository.list(s.scope,q,ids,this.sessions.realClock.now());}
 async setTariff(s:SessionContext,providerId:string,input:UpdateProviderTariff){if(!this.providers(s).includes(providerId))throw new RepositoryError('NOT_FOUND');return this.repository.setTariff(s.scope,providerId,input,this.sessions.realClock);}
 async populate(s:SessionContext){return this.populateScope(s.scope,s.info);}
 async populateScope(scope:DataScope,info:Pick<SessionInfo,'fixtureVersion'|'catalogRevision'|'mappingRevision'>){const repository=new TrafficActivityRepository(this.sessions.database),existing=await repository.existing(scope);if(existing)return existing;const catalog=catalogForIdentity(info.fixtureVersion,info.catalogRevision),plan=trafficActivityPlan(this.sessions.realClock.now(),catalog.providerCapabilities),sources=await trafficActivitySources(plan,catalog,info.mappingRevision);return repository.populate(scope,plan,sources,{fixtureVersion:info.fixtureVersion,mappingRevision:info.mappingRevision});}
 async issue(s:SessionContext,referralId:string){if(!s.visitorId)throw new RepositoryError('IDENTITY_REQUIRED');return this.repository.issue(s.scope,referralId,s.visitorId,this.sessions.realClock);}
}
