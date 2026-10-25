import { Module } from '@nestjs/common';
import { SessionModule } from '../sessions/session.module';
import { SessionService } from '../sessions/session.service';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/catalog.service';
import { ReferralModule } from '../referrals/referral.module';
import { ReferralService } from '../referrals/referral.service';
import { HotelService } from './hotel.service';
import { HotelController } from './hotel.controller';
@Module({ imports: [SessionModule, CatalogModule, ReferralModule], controllers: [HotelController], providers: [{ provide: HotelService, inject: [SessionService, CatalogService, ReferralService], useFactory: (sessions: SessionService, catalog: CatalogService, referrals: ReferralService) => new HotelService(sessions, catalog, referrals) }], exports: [HotelService] })
export class HotelModule {
}
