import {AdminReferralRepository} from '@torob-ticket/data-access';
import type {AdminReferralQuery} from '@torob-ticket/contracts';
import {Inject,Injectable} from '@nestjs/common';
import {SessionService} from '../sessions/session.service';
import type {SessionContext} from '../sessions/session-context';
@Injectable()
export class ReferralInspectionService{
 constructor(@Inject(SessionService)private readonly sessions:SessionService){}
 private get repository(){return new AdminReferralRepository(this.sessions.database);}
 list(s:SessionContext,q:AdminReferralQuery){return this.repository.list(s.scope,q);}
 detail(s:SessionContext,id:string){return this.repository.detail(s.scope,id);}
 cancel(s:SessionContext,id:string){return this.repository.cancel(s.scope,id,this.sessions.realClock.now());}
}
