import {Module} from '@nestjs/common';
import {SessionModule} from '../sessions/session.module';
import {CatalogModule} from '../catalog/catalog.module';
import {DemoController} from './demo.controller';
import {DemoService} from './demo.service';
@Module({imports:[SessionModule,CatalogModule],controllers:[DemoController],providers:[DemoService],exports:[DemoService]})
export class AdminControlsModule{}
