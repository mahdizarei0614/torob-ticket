import {DirectLoginModule} from '../direct-login/direct-login.controller';
import {ReferralModule} from '../referrals/referral.module';
import {Module} from '@nestjs/common';
import {SessionModule} from '../sessions/session.module';
import {ProviderTrafficService} from './provider-traffic.service';
import {ProviderTrafficController,OutboundReferralController} from './provider-traffic.controller';
import {ReviewerActivityService} from './reviewer-activity.service';
@Module({imports:[SessionModule,DirectLoginModule,ReferralModule],controllers:[ProviderTrafficController,OutboundReferralController],providers:[ProviderTrafficService,ReviewerActivityService]})
export class ProviderTrafficModule{}
