import {Body,Controller,Get,Inject,Param,Post,Query,Req,UseGuards} from '@nestjs/common';
import {AdminReferralQuerySchema,AdminResetInputSchema,type AdminReferralQuery} from '@torob-ticket/contracts';
import {SessionGuard} from '../sessions/session.guard';
import type {SessionRequest} from '../sessions/session-context';
import {repositoryHttpError} from '../sessions/session.service';
import {ZodValidationPipe} from '../common/zod-validation.pipe';
import {ReferralInspectionService} from './referral-inspection.service';
@Controller('v1/admin/referrals')
@UseGuards(SessionGuard)
export class ReferralInspectionController{
 constructor(@Inject(ReferralInspectionService)private readonly service:ReferralInspectionService){}
 @Get()list(@Req()r:SessionRequest,@Query(new ZodValidationPipe(AdminReferralQuerySchema))q:AdminReferralQuery){return this.service.list(r.sessionContext!,q).catch(repositoryHttpError);}
 @Get(':id')detail(@Req()r:SessionRequest,@Param('id')id:string){return this.service.detail(r.sessionContext!,id).catch(repositoryHttpError);}
}
@Controller('v1/referrals/intents')
@UseGuards(SessionGuard)
export class ReferralCancellationController{
 constructor(@Inject(ReferralInspectionService)private readonly service:ReferralInspectionService){}
 @Post(':id/cancel')cancel(@Req()r:SessionRequest,@Param('id')id:string,@Body(new ZodValidationPipe(AdminResetInputSchema))_body:Record<string,never>){void _body;return this.service.cancel(r.sessionContext!,id).catch(repositoryHttpError);}
}
