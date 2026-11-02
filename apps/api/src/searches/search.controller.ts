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
  async start(@Req() request: SessionRequest, @Body(new ZodValidationPipe(SearchRequestSchema)) body: SearchRequest, @Res({ passthrough: true }) response: ServerResponse) {
    // Fetch abort can happen before the browser learns the durable search ID.
    // Keep cleanup attached until delivery; ordinary SSE disconnects stay independent.
    let id: string | undefined;
    let disconnected = response.destroyed;
    const cancel = () => { if (id) void this.searches.cancelSearch(request.sessionContext!, id).catch(() => undefined); };
    const close = () => { if (!response.writableFinished) { disconnected = true; cancel(); } };
    response.once('close', close);
    try {
      const result = await this.searches.startSearch(request.sessionContext!, body);
      id = result.snapshot.searchId;
      if (disconnected) cancel();
      return result;
    } catch (error) { response.removeListener('close', close); return repositoryHttpError(error); }
  }
  @Get(':id')
  get(@Req() request: SessionRequest, @Param('id') id: string) { return this.searches.getSearch(request.sessionContext!, id).catch(repositoryHttpError); }
  @Post(':id/cancel')
  cancel(@Req() request: SessionRequest, @Param('id') id: string) { return this.searches.cancelSearch(request.sessionContext!, id).catch(repositoryHttpError); }
  @Post(':id/retry')
  retry(@Req() request: SessionRequest, @Param('id') id: string, @Body(new ZodValidationPipe(RetrySchema)) body: z.infer<typeof RetrySchema>) { return this.searches.retrySearch(request.sessionContext!, id, body.clientGeneration).catch(repositoryHttpError); }
  @Get(':id/events')
  events(@Req() request: SessionRequest, @Param('id') id: string, @Headers('last-event-id') lastId: string | undefined, @Res() response: ServerResponse) { return this.streams.serve(request.sessionContext!, id, lastId, response).catch(repositoryHttpError); }
}
