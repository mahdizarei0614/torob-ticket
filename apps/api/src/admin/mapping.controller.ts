import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApplyMappingInputSchema, MappingListQuerySchema, MappingPatchSchema, type ApplyMappingInput, type MappingListQuery, type MappingPatch } from '@torob-ticket/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionGuard } from '../sessions/session.guard';
import { repositoryHttpError } from '../sessions/session.service';
import type { SessionRequest } from '../sessions/session-context';
import { MappingService } from './mapping.service';
@Controller('v1/admin/mappings')
@UseGuards(SessionGuard)
export class MappingController {
  constructor(@Inject(MappingService) private readonly mappings:MappingService) {}
  @Get()
  list(@Req() request:SessionRequest,@Query(new ZodValidationPipe(MappingListQuerySchema)) query:MappingListQuery) { return this.mappings.list(request.sessionContext!,query).catch(repositoryHttpError); }
  @Post('preview')
  preview(@Req() request:SessionRequest,@Body(new ZodValidationPipe(MappingPatchSchema)) patch:MappingPatch) { return this.mappings.preview(request.sessionContext!,patch).catch(repositoryHttpError); }
  @Post('apply')
  apply(@Req() request:SessionRequest,@Body(new ZodValidationPipe(ApplyMappingInputSchema)) input:ApplyMappingInput) { return this.mappings.apply(request.sessionContext!,input).catch(repositoryHttpError); }
}
