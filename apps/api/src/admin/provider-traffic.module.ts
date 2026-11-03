import {Module} from '@nestjs/common';
import {SessionModule} from '../sessions/session.module';
import {ProviderTrafficService} from './provider-traffic.service';
import {ProviderTrafficController,OutboundReferralController} from './provider-traffic.controller';
@Module({imports:[SessionModule],controllers:[ProviderTrafficController,OutboundReferralController],providers:[ProviderTrafficService]})
export class ProviderTrafficModule{}
