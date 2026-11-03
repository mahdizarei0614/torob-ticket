import { Body, Controller, Get, Inject, Module, Post, Req, Res, UseGuards } from '@nestjs/common';
import { CreateDemoSessionInputSchema, type CreateDemoSessionInput } from '@torob-ticket/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SystemRealClock } from '../common/clocks';
import { SessionService } from './session.service';
import { SessionGuard } from './session.guard';
import type { CookieResponse, SessionRequest } from './session-context';
@Controller('v1/demo')
class SessionController {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}
  @Get('session')
  @UseGuards(SessionGuard)
  current(@Req() request: SessionRequest,@Res({passthrough:true})response:CookieResponse) { return this.sessions.current(request.sessionContext!,request,response); }
  @Post('session')
  create(@Body(new ZodValidationPipe(CreateDemoSessionInputSchema)) input: CreateDemoSessionInput, @Req() request: SessionRequest, @Res({ passthrough: true }) response: CookieResponse) { return this.sessions.createOrResume(input, request, response); }
  @Post('reset')
  @UseGuards(SessionGuard)
  reset(@Body(new ZodValidationPipe(CreateDemoSessionInputSchema)) input: CreateDemoSessionInput, @Req() request: SessionRequest, @Res({ passthrough: true }) response: CookieResponse) { return this.sessions.reset(request.sessionContext!, input, request, response); }
}
@Module({ controllers: [SessionController], providers: [SystemRealClock, SessionService, SessionGuard], exports: [SessionService, SessionGuard, SystemRealClock] })
export class SessionModule {}
