import {DirectLoginService} from '../direct-login/direct-login.service';
import {ReferralService} from '../referrals/referral.service';
import {BadRequestException,Controller,Get,Head,Inject,MethodNotAllowedException,Param,Patch,Post,Query,Req,Res,Body,UseGuards} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {TrafficQuerySchema,UpdateProviderTariffSchema,type TrafficQuery,type UpdateProviderTariff} from '@torob-ticket/contracts';
import {RepositoryError} from '@torob-ticket/data-access';
import {ZodValidationPipe} from '../common/zod-validation.pipe';
import {SessionGuard} from '../sessions/session.guard';
import type {SessionRequest} from '../sessions/session-context';
import {repositoryHttpError} from '../sessions/session.service';
import {ProviderTrafficService} from './provider-traffic.service';
export const OUTBOUND_PROVIDER_DESTINATION='https://zarei.xyz';
const trafficError=(error:unknown):never=>{if(error instanceof RepositoryError&&error.code==='INVALID_QUERY')throw new BadRequestException({code:'INVALID_QUERY',fieldPaths:[],retryable:false,requestId:randomUUID()});return repositoryHttpError(error);};
@Controller('v1/admin')
@UseGuards(SessionGuard)
export class ProviderTrafficController {
 constructor(@Inject(ProviderTrafficService)private readonly service:ProviderTrafficService){}
 @Post('traffic/populate')populate(@Req()r:SessionRequest){return this.service.populate(r.sessionContext!).catch(trafficError);}
 @Get('traffic')list(@Req()r:SessionRequest,@Query(new ZodValidationPipe(TrafficQuerySchema))q:TrafficQuery){return this.service.list(r.sessionContext!,q).catch(trafficError);}
 @Patch('providers/:id/tariff')setTariff(@Req()r:SessionRequest,@Param('id')id:string,@Body(new ZodValidationPipe(UpdateProviderTariffSchema))input:UpdateProviderTariff){return this.service.setTariff(r.sessionContext!,id,input).catch(trafficError);}
}
interface RedirectResponse {setHeader(name:string,value:string):void;redirect(status:number,url:string):void}
@Controller('v1/referrals')
@UseGuards(SessionGuard)
export class OutboundReferralController {
 constructor(@Inject(ProviderTrafficService)private readonly service:ProviderTrafficService,@Inject(DirectLoginService)private readonly direct:DirectLoginService,@Inject(ReferralService)private readonly referrals:ReferralService){}
 // Express may otherwise dispatch HEAD to a GET handler. Neither route may issue a ledger entry for HEAD.
 @Head(':id/outbound')head(){throw new MethodNotAllowedException();}
 @Get(':id/outbound')async outbound(@Req()r:SessionRequest&{method:string},@Param('id')id:string,@Res()response:RedirectResponse,@Query('visit')visit?:string){
  response.setHeader('Cache-Control','no-store, private');response.setHeader('Referrer-Policy','no-referrer');
  if(r.method!=='GET')throw new MethodNotAllowedException();
  const receipt=await this.referrals.getReferral(r.sessionContext!,id).catch(trafficError);
  const partner=await this.direct.partner(r.sessionContext!.scope,receipt.payload.quote.providerId);
  if(partner&&visit!=='1'){response.redirect(302,`/direct-login/choose/${id}`);return;}
  const binding=partner?await this.direct.bindReferral(r.sessionContext!,receipt):undefined;
  await this.service.issue(r.sessionContext!,id).catch(trafficError);
  const example=partner&&this.direct.exampleSiteUrl(partner);
  response.redirect(302,example&&binding?`${example}?ref=${binding.handle}`:partner?(partner.kind==='reference'?`/reference-provider/${partner.providerId}?referral=${id}`:new URL(partner.loginStartUrl).origin):OUTBOUND_PROVIDER_DESTINATION);
 }
}
