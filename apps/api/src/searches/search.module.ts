import { Module } from '@nestjs/common';
import { SessionModule } from '../sessions/session.module';
import { SessionService } from '../sessions/session.service';
import { ProviderModule } from '../providers/provider.module';
import { ProviderService } from '../providers/provider.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchStreamService } from './search-stream.service';
@Module({ imports: [SessionModule, ProviderModule], controllers: [SearchController], providers: [
  { provide: SearchService, inject: [SessionService, ProviderService], useFactory: (sessions: SessionService, providers: ProviderService) => new SearchService(sessions, providers) },
  { provide: SearchStreamService, inject: [SearchService], useFactory: (searches: SearchService) => new SearchStreamService(searches) },
], exports: [SearchService] })
export class SearchModule {}
