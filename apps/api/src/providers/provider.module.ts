import { Module } from '@nestjs/common';
import { SearchRepository } from '@torob-ticket/data-access';
import { SessionModule } from '../sessions/session.module';
import { SessionService } from '../sessions/session.service';
import { SystemRealClock } from '../common/clocks';
import { ProviderService } from './provider.service';
@Module({imports:[SessionModule],providers:[{provide:ProviderService,inject:[SessionService,SystemRealClock],useFactory:(sessions:SessionService,clock:SystemRealClock)=>new ProviderService(()=>new SearchRepository(sessions.database),clock)}],exports:[ProviderService]})
export class ProviderModule {}
