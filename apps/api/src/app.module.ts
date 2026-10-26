import {AdminModule} from './admin/admin.module';
import {HotelModule} from './hotels/hotel.module';
import {DemoAuthModule} from './auth/demo-auth.module';
import { ReferralModule } from './referrals/referral.module';
import { DatePriceModule } from './date-prices/date-price.module';
import { SearchModule } from './searches/search.module';
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SessionModule } from './sessions/session.module';
import { ProviderModule } from './providers/provider.module';
import { CatalogModule } from './catalog/catalog.module';
@Module({ imports: [AdminModule, HotelModule, DemoAuthModule, SessionModule, CatalogModule, ProviderModule, SearchModule, DatePriceModule, ReferralModule], controllers: [HealthController] })
export class AppModule {}
