import {Module} from '@nestjs/common';
import {AdminControlsModule} from './admin-controls.module';
import {SearchInspectionModule} from './search-inspection.module';
import {MappingModule} from './mapping.module';
import {ReferralInspectionModule} from './referral-inspection.module';
@Module({imports:[AdminControlsModule,SearchInspectionModule,MappingModule,ReferralInspectionModule]})
export class AdminModule{}
