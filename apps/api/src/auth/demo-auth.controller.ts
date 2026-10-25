import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AccountRepository } from '@torob-ticket/data-access';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionGuard } from '../sessions/session.guard';
import { SessionService, repositoryHttpError } from '../sessions/session.service';
import type { SessionRequest } from '../sessions/session-context';
const Empty = z.strictObject({});
@Controller('v1/auth/demo')
@UseGuards(SessionGuard)
export class DemoAuthController {
    constructor(
    @Inject(SessionService)
    private readonly sessions: SessionService) { }
    private get repository() { return new AccountRepository(this.sessions.database); }
    @Get()
    state(
    @Req()
    request: SessionRequest) { return this.repository.state(request.sessionContext!.scope).catch(repositoryHttpError); }
    @Post('sign-in')
    signIn(
    @Req()
    request: SessionRequest,
    @Body(new ZodValidationPipe(Empty))
    _body: z.infer<typeof Empty>) { void _body; return this.repository.signIn(request.sessionContext!.scope).catch(repositoryHttpError); }
    @Post('sign-out')
    signOut(
    @Req()
    request: SessionRequest,
    @Body(new ZodValidationPipe(Empty))
    _body: z.infer<typeof Empty>) { void _body; return this.repository.signOut(request.sessionContext!.scope).catch(repositoryHttpError); }
}
