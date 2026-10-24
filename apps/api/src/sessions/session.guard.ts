import { Injectable, Inject, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { SessionService } from './session.service';
import type { CookieResponse, SessionRequest } from './session-context';
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}
  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const http = execution.switchToHttp();
    const request = http.getRequest<SessionRequest>();
    request.sessionContext = await this.sessions.authenticate(request, http.getResponse<CookieResponse>());
    return true;
  }
}
