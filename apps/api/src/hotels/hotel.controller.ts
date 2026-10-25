import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { HotelSearchQuerySchema, IdSchema, type HotelSearchQuery } from '@torob-ticket/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionGuard } from '../sessions/session.guard';
import { repositoryHttpError } from '../sessions/session.service';
import type { SessionRequest } from '../sessions/session-context';
import { HotelService } from './hotel.service';
@Controller('v1/hotel-searches')
@UseGuards(SessionGuard)
export class HotelController {
    constructor(
    @Inject(HotelService)
    private readonly hotels: HotelService) {
    }
    @Post()
    search(
    @Req()
    request: SessionRequest, 
    @Body(new ZodValidationPipe(HotelSearchQuerySchema))
    input: HotelSearchQuery) {
        return this.hotels.searchHotels(request.sessionContext!, input).catch(repositoryHttpError);
    }
    @Get(':id')
    get(
    @Req()
    request: SessionRequest, 
    @Param('id', new ZodValidationPipe(IdSchema))
    id: string) {
        return this.hotels.get(request.sessionContext!, id).catch(repositoryHttpError);
    }
}
