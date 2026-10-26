import { Module } from '@nestjs/common';
import { SessionModule } from '../sessions/session.module';
import { SessionService } from '../sessions/session.service';
import { MappingController } from './mapping.controller';
import { MappingService } from './mapping.service';
@Module({imports:[SessionModule],controllers:[MappingController],providers:[{provide:MappingService,inject:[SessionService],useFactory:(sessions:SessionService)=>new MappingService(sessions)}],exports:[MappingService]})
export class MappingModule {}
