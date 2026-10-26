import { Module } from '@nestjs/common';
import { SessionModule } from '../sessions/session.module';
import { SessionService } from '../sessions/session.service';
import { SearchModule } from '../searches/search.module';
import { SearchService } from '../searches/search.service';
import { ProviderHealthService } from './provider-health.service';
import { SearchInspectionService } from './search-inspection.service';
import { SearchInspectionController } from './search-inspection.controller';

@Module({ imports: [SessionModule, SearchModule], controllers: [SearchInspectionController], providers: [
  { provide: ProviderHealthService, inject: [SessionService], useFactory: (sessions: SessionService) => new ProviderHealthService(sessions) },
  { provide: SearchInspectionService, inject: [SessionService, SearchService], useFactory: (sessions: SessionService, searches: SearchService) => new SearchInspectionService(sessions, searches) },
] })
export class SearchInspectionModule {}
