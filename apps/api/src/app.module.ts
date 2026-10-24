import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SessionModule } from './sessions/session.module';
import { CatalogModule } from './catalog/catalog.module';
@Module({ imports: [SessionModule, CatalogModule], controllers: [HealthController] })
export class AppModule {}
