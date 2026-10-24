import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SessionService } from './sessions/session.service';
@Controller('health')
export class HealthController {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}
  @Get('live')
  live() { return { status: 'ok', service: 'torob-ticket-api', mode: 'demo' }; }
  @Get('ready')
  async ready() {
    try { await this.sessions.ensureReady(); return { status: 'ready', database: 'ready', migrations: 'ready', seed: 'ready' }; }
    catch { throw new ServiceUnavailableException({ status: 'not-ready' }); }
  }
}
