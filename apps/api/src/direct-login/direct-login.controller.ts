import {ENROLLMENT_VERIFIER,unavailableVerifier} from './enrollment-verifier';
import {sha256} from '@torob-ticket/provider-sdk';
import { Body, Controller, Get, Head, Header, HttpCode, HttpException, BadRequestException, UnauthorizedException, Inject, Injectable, MethodNotAllowedException, Module, Param, Post, Query, Req, Res, UseGuards, UseInterceptors, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { z } from 'zod';
import { AuthorizeSchema, CommitmentProofSchema, IdSchema, PartnerInputSchema, PhoneSchema, TokenRequestSchema, TravelerProfileSchema, type TravelerProfile, type AuthorizeInput, type PartnerInput } from '@torob-ticket/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionGuard } from '../sessions/session.guard';
import { SessionModule } from '../sessions/session.module';
import type { CookieResponse, SessionRequest } from '../sessions/session-context';
import { ReferralModule } from '../referrals/referral.module';
import { ReferralService } from '../referrals/referral.service';
import { ProviderTrafficService } from '../admin/provider-traffic.service';
import { DirectLoginService, configuredOrigin } from './direct-login.service';

interface Request extends SessionRequest { method: string; headers: SessionRequest['headers'] & { origin?: string; authorization?: string; 'sec-fetch-site'?: string } }
interface Response extends CookieResponse { redirect(code: number, url: string): void }
@Injectable()
class PrivateResponse implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store, private'); response.setHeader('Pragma', 'no-cache'); response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('X-Content-Type-Options', 'nosniff');
    return next.handle();
  }
}
const CodeInput = z.strictObject({ phone: PhoneSchema });
const VerifyInput = z.strictObject({ id: z.string().max(100), code: z.string().regex(/^[0-9]{6}$/) });
const ConsentInput = z.strictObject({ approved: z.boolean() });
const Empty = z.strictObject({});

@Controller('v1/direct-login')
@UseInterceptors(PrivateResponse)
@UseGuards(SessionGuard)
class DirectBrowserController {
  constructor(@Inject(DirectLoginService) private readonly service: DirectLoginService, @Inject(ReferralService) private readonly referrals: ReferralService, @Inject(ProviderTrafficService) private readonly traffic: ProviderTrafficService) {}
  @Get('account') account(@Req() request: Request) { return this.service.account(request.sessionContext!.scope, request); }
  @Post('phone/code') code(@Req() r: Request, @Res({ passthrough: true }) response: Response, @Body(new ZodValidationPipe(CodeInput)) input: z.infer<typeof CodeInput>) { this.service.assertBrowserMutation(r); return this.service.requestCode(r.sessionContext!.scope, input.phone, 'torob', this.service.browser(r.sessionContext!.scope, r, response)); }
  @Post('phone/verify') async verify(@Req() r: Request, @Res({ passthrough: true }) response: Response, @Body(new ZodValidationPipe(VerifyInput)) input: z.infer<typeof VerifyInput>) {
    this.service.assertBrowserMutation(r);
    const browser = this.service.cookie(r.sessionContext!.scope, 'browser', r);
    const result = await this.service.verifyCode(r.sessionContext!.scope, input.id, input.code, sha256(browser ?? ''), 'torob');
    this.service.setCookie(r.sessionContext!.scope, 'identity', result.token, response);
    return { identity: result.identity };
  }
  @Post('profile') profile(@Req() r: Request,@Body(new ZodValidationPipe(TravelerProfileSchema)) input:TravelerProfile){this.service.assertBrowserMutation(r);return this.service.saveProfile(r.sessionContext!.scope,r,input);}
  @Post('logout') async logout(@Req() r: Request, @Body(new ZodValidationPipe(Empty)) _body: object) { void _body; this.service.assertBrowserMutation(r); return this.service.logout(r.sessionContext!.scope, r); }
  @Get('choices/:id') async choices(@Req() r: Request, @Param('id') id: string) { return this.service.choices(r.sessionContext!, await this.referrals.getReferral(r.sessionContext!, id)); }
  @Head('start/:id') head() { throw new MethodNotAllowedException(); }
  @Get('start/:id') async start(@Req() r: Request, @Param('id') id: string, @Res() response: Response) {
    if (r.method !== 'GET') throw new MethodNotAllowedException();
    const receipt = await this.referrals.getReferral(r.sessionContext!, id);
    const binding = await this.service.bindReferral(r.sessionContext!, receipt);
    await this.traffic.issue(r.sessionContext!, id);
    const destination = new URL(binding.loginStartUrl); destination.searchParams.set('ref', binding.handle);
    response.redirect(302, destination.href);
  }
  @Post('authorizations') async begin(@Req() r: Request, @Res({ passthrough: true }) response: Response, @Body(new ZodValidationPipe(AuthorizeSchema)) input: AuthorizeInput) {
    this.service.assertBrowserMutation(r);
    const id = await this.service.authorize(r.sessionContext!.scope, input, this.service.browser(r.sessionContext!.scope, r, response), r);
    return { redirect: `/direct-login/authorize/${id}` };
  }
  @Get('authorize') async authorize(@Req() r: Request, @Res() response: Response, @Query(new ZodValidationPipe(AuthorizeSchema)) input: AuthorizeInput) {
    const browser = this.service.browser(r.sessionContext!.scope, r, response);
    const id = await this.service.authorize(r.sessionContext!.scope, input, browser, r);
    response.redirect(302, `/direct-login/authorize/${id}`);
  }
  @Get('flows/:id') async flow(@Req() r: Request, @Param('id') id: string) {
    return this.service.flow(r.sessionContext!.scope, id, sha256(this.service.cookie(r.sessionContext!.scope, 'browser', r) ?? ''), r);
  }
  @Post('flows/:id/consent') async consent(@Req() r: Request, @Param('id') id: string, @Body(new ZodValidationPipe(ConsentInput)) input: z.infer<typeof ConsentInput>) {
    this.service.assertBrowserMutation(r);
    return this.service.consent(r.sessionContext!.scope, id, sha256(this.service.cookie(r.sessionContext!.scope, 'browser', r) ?? ''), r, input.approved);
  }
}
@Controller('v1/direct-login')
@UseInterceptors(PrivateResponse)
class DirectBackchannelController {
  constructor(@Inject(DirectLoginService) private readonly service: DirectLoginService) {}
  @Get('issuer/:clientId/.well-known/openid-configuration') metadata(@Param('clientId') clientId: string) { return this.service.metadata(clientId); }
  @Get('issuer/:clientId/jwks') jwks(@Param('clientId') clientId: string) { return this.service.jwks(clientId); }
  @Post('token') @HttpCode(200) @Header('Cache-Control', 'no-store') async token(@Body() body: unknown) {
    const parsed = TokenRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({error:'invalid_request'});
    try { return await this.service.token(parsed.data); }
    catch (error) { if (error instanceof UnauthorizedException) throw new UnauthorizedException({error:'invalid_client'}); if (error instanceof HttpException && error.getStatus() === 400) throw new BadRequestException({error:'invalid_grant'}); throw error; }
  }
  @Get('issuer/:clientId/userinfo') userinfo(@Param('clientId') clientId: string, @Req() r: Request) { return this.service.userinfo(clientId, /^Bearer ([A-Za-z0-9_-]{43})$/.exec(r.headers.authorization ?? '')?.[1] ?? ''); }
  @Post('client-status') status(@Body(new ZodValidationPipe(z.strictObject({client_id:IdSchema,client_secret:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}))) input:{client_id:string;client_secret:string}){return this.service.clientStatus(input.client_id,input.client_secret);}
  @Post('example-registration') installation(@Body(new ZodValidationPipe(z.strictObject({client_id:IdSchema,code:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}))) input:{client_id:string;code:string}){return this.service.exchangeExampleInstallation(input.client_id,input.code);}
  @Post('account-events') event(@Body(new ZodValidationPipe(z.strictObject({ client_id: z.string(), client_secret: z.string(), referral_id: z.string(), sub: z.string(), account_id: IdSchema, attestation: z.string().max(16000).optional() }))) input: { client_id: string; client_secret: string; referral_id: string; sub: string; account_id: string; attestation?: string }) { return this.service.reportAccount(input.client_id, input.client_secret, input.referral_id, input.sub, input.account_id, input.attestation); }
  @Post('commitments') commitment(@Body(new ZodValidationPipe(z.strictObject({ client_id: z.string(), client_secret: z.string(), root: z.string().regex(/^[a-f0-9]{64}$/), attestation: z.string().max(16000) }))) input: { client_id: string; client_secret: string; root: string; attestation: string }) { return this.service.publishCommitment(input.client_id, input.client_secret, input.root, input.attestation); }
  @Post('existing-proofs') proof(@Body(new ZodValidationPipe(z.strictObject({ client_id: z.string(), client_secret: z.string(), ref: z.string(), proof: CommitmentProofSchema }))) input: { client_id: string; client_secret: string; ref: string; proof: z.infer<typeof CommitmentProofSchema> }) { return this.service.proveExisting(input.client_id, input.client_secret, input.ref, input.proof); }
  @Post('acknowledgments') acknowledgment(@Body(new ZodValidationPipe(z.strictObject({ client_id: z.string(), client_secret: z.string(), ref: z.string() }))) input: { client_id: string; client_secret: string; ref: string }) { return this.service.externalAcknowledgment(input.client_id, input.client_secret, input.ref); }
}
@Controller('v1/admin/direct-login')
@UseGuards(SessionGuard)
@UseInterceptors(PrivateResponse)
class DirectAdminController {
  constructor(@Inject(DirectLoginService) private readonly service: DirectLoginService) {}
  @Get() list(@Req() r: Request) { return this.service.admin(r.sessionContext!.scope); }
  @Post('example-provider') example(@Req() r:Request,@Body(new ZodValidationPipe(z.strictObject({providerId:IdSchema,name:z.string().trim().min(1).max(100)}))) input:{providerId:string;name:string}){this.service.assertBrowserMutation(r);return this.service.installExampleProvider(r.sessionContext!,input.providerId,input.name);}
  @Post('partners') partner(@Req() r: Request, @Body(new ZodValidationPipe(PartnerInputSchema)) input: PartnerInput) { this.service.assertBrowserMutation(r); return this.service.savePartner(r.sessionContext!, input); }
}
@Controller('v1/reference-provider/:providerId')
@UseGuards(SessionGuard)
@UseInterceptors(PrivateResponse)
class ReferenceController {
  constructor(@Inject(DirectLoginService) private readonly service: DirectLoginService, @Inject(ReferralService) private readonly referrals: ReferralService) {}
  @Get() async page(@Req() r: Request, @Param('providerId') providerId: string, @Query('referral') referral?: string) { return this.service.referencePage(r.sessionContext!.scope, providerId, r, referral ? await this.referrals.getReferral(r.sessionContext!, referral) : undefined); }
  @Head('start') head() { throw new MethodNotAllowedException(); }
  @Get('start') async start(@Req() r: Request, @Res() response: Response, @Param('providerId') providerId: string, @Query('ref') ref: string) { if (r.method !== 'GET') throw new MethodNotAllowedException(); const result = await this.service.referenceStart(r.sessionContext!.scope, providerId, ref, r); this.service.setCookie(r.sessionContext!.scope, `flow_${providerId}`, result.token, response, 600); response.redirect(302, result.url); }
  @Get('callback') async callback(@Req() r: Request, @Res() response: Response, @Param('providerId') providerId: string, @Query() query: Record<string, string>) {
    const callback = new URL(`/api/v1/reference-provider/${providerId}/callback`, configuredOrigin());
    for (const [key, value] of Object.entries(query)) { if (typeof value !== 'string') throw new MethodNotAllowedException(); callback.searchParams.set(key, value); }
    let result;
    try { result = await this.service.referenceCallback(r.sessionContext!.scope, providerId, r, callback); }
    catch { const referral = await this.service.callbackRecovery(r.sessionContext!.scope, providerId, r); response.redirect(302, `/reference-provider/${providerId}?login=interrupted${referral ? `&referral=${referral}` : ''}`); return; }
    if ('token' in result && result.token) this.service.setCookie(r.sessionContext!.scope, `provider_${providerId}`, result.token, response);
    response.redirect(302, `/reference-provider/${providerId}${'referralId' in result ? `?referral=${result.referralId}${'conflict' in result ? '&link=required' : ''}` : '?cancelled=1'}`);
  }
  @Post('phone/code') code(@Req() r: Request, @Res({ passthrough: true }) response: Response, @Param('providerId') providerId: string, @Body(new ZodValidationPipe(CodeInput)) input: z.infer<typeof CodeInput>) { this.service.assertBrowserMutation(r); return this.service.requestCode(r.sessionContext!.scope, input.phone, providerId, this.service.browser(r.sessionContext!.scope, r, response)); }
  @Post('phone/verify') async verify(@Req() r: Request, @Res({ passthrough: true }) response: Response, @Param('providerId') providerId: string, @Body(new ZodValidationPipe(VerifyInput)) input: z.infer<typeof VerifyInput>) {
    this.service.assertBrowserMutation(r);
    const result = await this.service.verifyCode(r.sessionContext!.scope, input.id, input.code, sha256(this.service.cookie(r.sessionContext!.scope, 'browser', r) ?? ''), providerId);
    this.service.setCookie(r.sessionContext!.scope, `provider_${providerId}`, result.token, response); return { identity: result.identity };
  }
  @Post('logout') logout(@Req() r: Request, @Param('providerId') providerId: string, @Body(new ZodValidationPipe(Empty)) _body: object) { void _body; this.service.assertBrowserMutation(r); return this.service.referenceLogout(r.sessionContext!.scope, providerId, r); }
}
@Module({ imports: [SessionModule, ReferralModule], providers: [DirectLoginService, ProviderTrafficService, { provide: ENROLLMENT_VERIFIER, useValue: unavailableVerifier }], controllers: [DirectBrowserController, DirectBackchannelController, DirectAdminController, ReferenceController], exports: [DirectLoginService] })
export class DirectLoginModule {}
