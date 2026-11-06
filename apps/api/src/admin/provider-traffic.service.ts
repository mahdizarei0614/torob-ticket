import {Inject,Injectable} from '@nestjs/common';
import {ProviderTrafficRepository,TrafficActivityRepository,trafficActivityPlan,RepositoryError} from '@torob-ticket/data-access';
import {catalogForIdentity} from '@torob-ticket/fixtures';
import type {TrafficQuery,UpdateProviderTariff} from '@torob-ticket/contracts';
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
 async populate(s:SessionContext){const repository=new TrafficActivityRepository(this.sessions.database),existing=await repository.existing(s.scope);if(existing)return existing;const catalog=catalogForIdentity(s.info.fixtureVersion,s.info.catalogRevision),plan=trafficActivityPlan(this.sessions.realClock.now(),catalog.providerCapabilities),sources=await trafficActivitySources(plan,catalog,s.info.mappingRevision);return repository.populate(s.scope,plan,sources,{fixtureVersion:s.info.fixtureVersion,mappingRevision:s.info.mappingRevision});}
 async issue(s:SessionContext,referralId:string){if(!s.visitorId)throw new RepositoryError('IDENTITY_REQUIRED');return this.repository.issue(s.scope,referralId,s.visitorId,this.sessions.realClock);}
}
