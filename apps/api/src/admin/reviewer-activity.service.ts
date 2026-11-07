import {Inject,Injectable,type OnApplicationBootstrap,type OnModuleDestroy,type OnModuleInit} from '@nestjs/common';
import type {SessionInfo} from '@torob-ticket/contracts';
import {RepositoryError,ReviewerActivityRepository,reviewerActivityTemplateId} from '@torob-ticket/data-access';
import {fixtureIdentity} from '@torob-ticket/fixtures';
import {localReviewEnabled} from '../direct-login/local-review';
import {SessionService} from '../sessions/session.service';
import type {SessionContext} from '../sessions/session-context';
import {ProviderTrafficService} from './provider-traffic.service';

export const reviewerActivityEnabled=()=>process.env.TOROBTICKET_REVIEWER_ACTIVITY==='true'&&localReviewEnabled();
type Identity=Pick<SessionInfo,'fixtureVersion'|'catalogRevision'|'mappingRevision'>;
@Injectable()
export class ReviewerActivityService implements OnModuleInit,OnApplicationBootstrap,OnModuleDestroy {
 private release?:()=>void;
 private readonly flights=new Map<string,Promise<{sessionId:string}>>();
 constructor(@Inject(SessionService)private readonly sessions:SessionService,@Inject(ProviderTrafficService)private readonly traffic:ProviderTrafficService){}
 private get repository(){return new ReviewerActivityRepository(this.sessions.database);}
 onModuleInit(){this.release=this.sessions.registerWorkspaceInitializer((context,options)=>this.initialize(context,options.fresh));}
 async onApplicationBootstrap(){if(reviewerActivityEnabled()){await this.sessions.ensureReady();await this.template({...fixtureIdentity,mappingRevision:'mapping-v1'});}}
 async onModuleDestroy(){this.release?.();await Promise.allSettled(this.flights.values());}
 private async template(identity:Identity){
  const now=this.sessions.realClock.now(),key=reviewerActivityTemplateId(identity,now),existing=this.flights.get(key);if(existing)return existing;
  const work=(async()=>{const scope=await this.repository.ensureTemplate(identity,now);await this.traffic.populateScope(scope,identity);return scope;})();
  this.flights.set(key,work);try{return await work;}finally{if(this.flights.get(key)===work)this.flights.delete(key);}
 }
 async initialize(context:SessionContext,fresh:boolean){
  if(!reviewerActivityEnabled())return;
  if(fresh)await this.repository.begin(context.scope);
  if(!await this.repository.pending(context.scope))return;
  try{const source=await this.template(context.info);await this.repository.copy(context.scope,source);await this.repository.finish(context.scope,'ready');}
  catch(error){if(error instanceof RepositoryError&&error.code==='TRAFFIC_HISTORY_CONFLICT'){await this.repository.finish(context.scope,'skipped-existing-data');return;}throw error;}
 }
}
