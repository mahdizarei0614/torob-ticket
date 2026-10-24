import { SearchModule } from './searches/search.module';
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SessionModule } from './sessions/session.module';
import { ProviderModule } from './providers/provider.module';
import { CatalogModule } from './catalog/catalog.module';
@Module({ imports: [SessionModule, CatalogModule, ProviderModule, SearchModule], controllers: [HealthController] })
export class AppModule {}
