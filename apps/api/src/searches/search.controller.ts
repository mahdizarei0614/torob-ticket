import { Body, Controller, Get, Headers, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { z } from 'zod';
import { IdSchema, SearchRequestSchema, type SearchRequest } from '@torob-ticket/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionGuard } from '../sessions/session.guard';
import { repositoryHttpError } from '../sessions/session.service';
import type { SessionRequest } from '../sessions/session-context';
import { SearchService } from './search.service';
import { SearchStreamService } from './search-stream.service';
const RetrySchema = z.strictObject({ clientGeneration: IdSchema });
@Controller('v1/searches')
@UseGuards(SessionGuard)
export class SearchController {
  constructor(@Inject(SearchService) private readonly searches: SearchService, @Inject(SearchStreamService) private readonly streams: SearchStreamService) {}
  @Post()
  start(@Req() request: SessionRequest, @Body(new ZodValidationPipe(SearchRequestSchema)) body: SearchRequest) { return this.searches.startSearch(request.sessionContext!, body).catch(repositoryHttpError); }
  @Get(':id')
  get(@Req() request: SessionRequest, @Param('id') id: string) { return this.searches.getSearch(request.sessionContext!, id).catch(repositoryHttpError); }
  @Post(':id/cancel')
  cancel(@Req() request: SessionRequest, @Param('id') id: string) { return this.searches.cancelSearch(request.sessionContext!, id).catch(repositoryHttpError); }
  @Post(':id/retry')
  retry(@Req() request: SessionRequest, @Param('id') id: string, @Body(new ZodValidationPipe(RetrySchema)) body: z.infer<typeof RetrySchema>) { return this.searches.retrySearch(request.sessionContext!, id, body.clientGeneration).catch(repositoryHttpError); }
  @Get(':id/events')
  events(@Req() request: SessionRequest, @Param('id') id: string, @Headers('last-event-id') lastId: string | undefined, @Res() response: ServerResponse) { return this.streams.serve(request.sessionContext!, id, lastId, response).catch(repositoryHttpError); }
}
