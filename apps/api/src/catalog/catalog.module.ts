import { Module } from '@nestjs/common';
import { SessionModule } from '../sessions/session.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
@Module({imports:[SessionModule],controllers:[CatalogController],providers:[CatalogService]})
export class CatalogModule {}
