import { Module } from '@nestjs/common';
import { SessionModule } from '../sessions/session.module';
import { SessionService } from '../sessions/session.service';
import { ProviderModule } from '../providers/provider.module';
import { ProviderService } from '../providers/provider.service';
import { DatePriceService } from './date-price.service';
import { DatePriceController } from './date-price.controller';
@Module({ imports: [SessionModule, ProviderModule], controllers: [DatePriceController], providers: [{ provide: DatePriceService, inject: [SessionService, ProviderService], useFactory: (sessions: SessionService, providers: ProviderService) => new DatePriceService(sessions, providers) }], exports: [DatePriceService] })
export class DatePriceModule {}
