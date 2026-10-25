import { Module } from '@nestjs/common';
import { SessionModule } from '../sessions/session.module';
import { CatalogModule } from '../catalog/catalog.module';
import { DemoAuthController } from './demo-auth.controller';
import { SavedSearchController } from '../saved-searches/saved-search.controller';
import { SavedSearchService } from '../saved-searches/saved-search.service';
@Module({ imports: [SessionModule, CatalogModule], controllers: [DemoAuthController, SavedSearchController], providers: [SavedSearchService] })
export class DemoAuthModule {
}
