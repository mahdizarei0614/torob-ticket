import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SessionModule } from './sessions/session.module';
@Module({ imports: [SessionModule], controllers: [HealthController] })
export class AppModule {}
