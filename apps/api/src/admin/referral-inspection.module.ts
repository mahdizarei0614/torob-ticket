import {Module} from '@nestjs/common';
import {SessionModule} from '../sessions/session.module';
import {ReferralInspectionController,ReferralCancellationController} from './referral-inspection.controller';
import {ReferralInspectionService} from './referral-inspection.service';
@Module({imports:[SessionModule],controllers:[ReferralInspectionController,ReferralCancellationController],providers:[ReferralInspectionService]})
export class ReferralInspectionModule{}
