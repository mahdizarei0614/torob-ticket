import {Inject,Injectable} from '@nestjs/common';
import {ProviderTrafficRepository,RepositoryError} from '@torob-ticket/data-access';
import {catalogForIdentity} from '@torob-ticket/fixtures';
import type {TrafficQuery,UpdateProviderTariff} from '@torob-ticket/contracts';
import {SessionService} from '../sessions/session.service';
import type {SessionContext} from '../sessions/session-context';
@Injectable()
export class ProviderTrafficService {
 constructor(@Inject(SessionService)private readonly sessions:SessionService){}
 private get repository(){return new ProviderTrafficRepository(this.sessions.database);}
 private providers(s:SessionContext){return catalogForIdentity(s.info.fixtureVersion,s.info.catalogRevision).providerCapabilities.map(p=>p.providerId);}
 async list(s:SessionContext,q:TrafficQuery){const ids=this.providers(s);if(q.providerId&&!ids.includes(q.providerId))throw new RepositoryError('NOT_FOUND');return this.repository.list(s.scope,q,ids,this.sessions.realClock.now());}
 async setTariff(s:SessionContext,providerId:string,input:UpdateProviderTariff){if(!this.providers(s).includes(providerId))throw new RepositoryError('NOT_FOUND');return this.repository.setTariff(s.scope,providerId,input,this.sessions.realClock);}
 async issue(s:SessionContext,referralId:string){if(!s.visitorId)throw new RepositoryError('IDENTITY_REQUIRED');return this.repository.issue(s.scope,referralId,s.visitorId,this.sessions.realClock);}
}
