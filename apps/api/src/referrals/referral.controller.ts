import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ConfirmReferralInputSchema, ReferralSelectionSchema, type ConfirmReferralInput, type ReferralSelection } from '@torob-ticket/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionGuard } from '../sessions/session.guard';
import { repositoryHttpError } from '../sessions/session.service';
import type { SessionRequest } from '../sessions/session-context';
import { ReferralService } from './referral.service';
@Controller('v1/referrals')
@UseGuards(SessionGuard)
export class ReferralController {
    constructor(
    @Inject(ReferralService)
    private readonly referrals: ReferralService) { }
    @Post('prepare')
    prepare(
    @Req()
    request: SessionRequest,
    @Body(new ZodValidationPipe(ReferralSelectionSchema))
    body: ReferralSelection) { return this.referrals.prepareReferral(request.sessionContext!, body).catch(repositoryHttpError); }
    @Post('confirm')
    confirm(
    @Req()
    request: SessionRequest,
    @Body(new ZodValidationPipe(ConfirmReferralInputSchema))
    body: ConfirmReferralInput) { return this.referrals.confirmReferral(request.sessionContext!, body).catch(repositoryHttpError); }
    @Get(':id')
    get(
    @Req()
    request: SessionRequest,
    @Param('id')
    id: string) { return this.referrals.getReferral(request.sessionContext!, id).catch(repositoryHttpError); }
}
