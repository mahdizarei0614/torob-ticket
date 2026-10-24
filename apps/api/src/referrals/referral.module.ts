import { Module } from '@nestjs/common';
import { SessionModule } from '../sessions/session.module';
import { SessionService } from '../sessions/session.service';
import { ProviderModule } from '../providers/provider.module';
import { ProviderService } from '../providers/provider.service';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
@Module({ imports: [SessionModule, ProviderModule], controllers: [ReferralController], providers: [{ provide: ReferralService, inject: [SessionService, ProviderService], useFactory: (sessions: SessionService, providers: ProviderService) => new ReferralService(sessions, providers) }], exports: [ReferralService] })
export class ReferralModule {
}
