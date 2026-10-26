import {Body,Controller,Get,Inject,Param,Patch,Post,Req,Res,UseGuards} from '@nestjs/common';
import {AdminResetInputSchema,AdminSetProviderOverrideInputSchema,AdminSetScenarioInputSchema,IdSchema,type AdminResetInput,type AdminSetProviderOverrideInput,type AdminSetScenarioInput} from '@torob-ticket/contracts';
import {ZodValidationPipe} from '../common/zod-validation.pipe';
import {SessionGuard} from '../sessions/session.guard';
import {repositoryHttpError} from '../sessions/session.service';
import type {CookieResponse,SessionRequest} from '../sessions/session-context';
import {DemoService} from './demo.service';
@Controller('v1/admin')
@UseGuards(SessionGuard)
export class DemoController{
 constructor(@Inject(DemoService)private readonly controls:DemoService){}
 @Get('config')config(@Req()request:SessionRequest){return this.controls.config(request.sessionContext!).catch(repositoryHttpError);}
 @Post('scenario')scenario(@Req()request:SessionRequest,@Body(new ZodValidationPipe(AdminSetScenarioInputSchema))input:AdminSetScenarioInput){return this.controls.setScenario(request.sessionContext!,input).catch(repositoryHttpError);}
 @Patch('providers/:id')provider(@Req()request:SessionRequest,@Param('id',new ZodValidationPipe(IdSchema))id:string,@Body(new ZodValidationPipe(AdminSetProviderOverrideInputSchema))input:AdminSetProviderOverrideInput){return this.controls.setProvider(request.sessionContext!,id,input).catch(repositoryHttpError);}
 @Post('reset')reset(@Req()request:SessionRequest,@Res({passthrough:true})response:CookieResponse,@Body(new ZodValidationPipe(AdminResetInputSchema))input:AdminResetInput){void input;return this.controls.reset(request.sessionContext!,request,response).catch(repositoryHttpError);}
}
