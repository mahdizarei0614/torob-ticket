import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminReplayInputSchema, AdminSearchInspectionQuerySchema, AdminSearchListQuerySchema, IdSchema, type AdminReplayInput, type AdminSearchInspectionQuery, type AdminSearchListQuery } from '@torob-ticket/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionGuard } from '../sessions/session.guard';
import type { SessionRequest } from '../sessions/session-context';
import { repositoryHttpError } from '../sessions/session.service';
import { ProviderHealthService } from './provider-health.service';
import { SearchInspectionService } from './search-inspection.service';

@Controller('v1/admin')
@UseGuards(SessionGuard)
export class SearchInspectionController {
  constructor(@Inject(SearchInspectionService) private readonly searches: SearchInspectionService, @Inject(ProviderHealthService) private readonly providers: ProviderHealthService) {}
  @Get('providers')
  health(@Req() request: SessionRequest) { return this.providers.get(request.sessionContext!).catch(repositoryHttpError); }
  @Get('searches')
  list(@Req() request: SessionRequest, @Query(new ZodValidationPipe(AdminSearchListQuerySchema)) query: AdminSearchListQuery) { return this.searches.list(request.sessionContext!, query).catch(repositoryHttpError); }
  @Get('searches/:id')
  get(@Req() request: SessionRequest, @Param('id', new ZodValidationPipe(IdSchema)) id: string, @Query(new ZodValidationPipe(AdminSearchInspectionQuerySchema)) query: AdminSearchInspectionQuery) { return this.searches.get(request.sessionContext!, id, query).catch(repositoryHttpError); }
  @Post('searches/:id/replay')
  replay(@Req() request: SessionRequest, @Param('id', new ZodValidationPipe(IdSchema)) id: string, @Body(new ZodValidationPipe(AdminReplayInputSchema)) body: AdminReplayInput) { return this.searches.replay(request.sessionContext!, id, body).catch(repositoryHttpError); }
}
