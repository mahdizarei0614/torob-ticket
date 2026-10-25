import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IdSchema, SaveSearchInputSchema, type SaveSearchInput } from '@torob-ticket/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionGuard } from '../sessions/session.guard';
import { repositoryHttpError } from '../sessions/session.service';
import type { SessionRequest } from '../sessions/session-context';
import { SavedSearchService } from './saved-search.service';
@Controller('v1/saved-searches')
@UseGuards(SessionGuard)
export class SavedSearchController {
    constructor(
    @Inject(SavedSearchService)
    private readonly saved: SavedSearchService) { }
    @Get()
    list(
    @Req()
    request: SessionRequest) { return this.saved.list(request.sessionContext!).catch(repositoryHttpError); }
    @Post()
    save(
    @Req()
    request: SessionRequest, 
    @Body(new ZodValidationPipe(SaveSearchInputSchema))
    input: SaveSearchInput) { return this.saved.save(request.sessionContext!, input).catch(repositoryHttpError); }
    @Get(':id')
    get(
    @Req()
    request: SessionRequest, 
    @Param('id', new ZodValidationPipe(IdSchema))
    id: string) { return this.saved.get(request.sessionContext!, id).catch(repositoryHttpError); }
    @Delete(':id')
    delete(
    @Req()
    request: SessionRequest, 
    @Param('id', new ZodValidationPipe(IdSchema))
    id: string) { return this.saved.delete(request.sessionContext!, id).catch(repositoryHttpError); }
}
