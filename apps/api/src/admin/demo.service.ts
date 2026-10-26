import {randomUUID} from 'node:crypto';
import {Inject,Injectable} from '@nestjs/common';
import type {AdminSetProviderOverrideInput,AdminSetScenarioInput} from '@torob-ticket/contracts';
import {AdminControlsRepository} from '@torob-ticket/data-access';
import {CatalogService} from '../catalog/catalog.service';
import {SessionService} from '../sessions/session.service';
import type {CookieResponse,SessionContext,SessionRequest} from '../sessions/session-context';
@Injectable()
export class DemoService{
 constructor(@Inject(SessionService)private readonly sessions:SessionService,@Inject(CatalogService)private readonly catalog:CatalogService){}
 private repository(context:SessionContext){return new AdminControlsRepository(this.sessions.database,this.catalog.get(context).providerCapabilities.map(p=>p.providerId));}
 config(context:SessionContext){return this.repository(context).get(context.scope);}
 async setScenario(context:SessionContext,input:AdminSetScenarioInput){const config=await this.repository(context).setScenario(context.scope,input,this.sessions.realClock.now());if(config.revision!==input.baseRevision)this.sessions.cancelCurrentWork(context,'configuration-changed');return config;}
 async setProvider(context:SessionContext,id:string,input:AdminSetProviderOverrideInput){const config=await this.repository(context).setProvider(context.scope,id,input,this.sessions.realClock.now());if(config.revision!==input.baseRevision)this.sessions.cancelCurrentWork(context,'configuration-changed');return config;}
 reset(context:SessionContext,request:SessionRequest,response:CookieResponse){return this.sessions.reset(context,{scenario:'normal'},request,response,{scenarioRevision:randomUUID(),auditReason:'admin-reset'});}
}
