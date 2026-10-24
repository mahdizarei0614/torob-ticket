import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { DatePriceQuerySchema, IdSchema, type DatePriceQuery } from '@torob-ticket/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionGuard } from '../sessions/session.guard';
import { repositoryHttpError } from '../sessions/session.service';
import type { SessionRequest } from '../sessions/session-context';
import { DatePriceService } from './date-price.service';
const PollViewSchema = z.strictObject({ clientGeneration: IdSchema });
@Controller('v1/date-prices')
@UseGuards(SessionGuard)
export class DatePriceController {
  constructor(@Inject(DatePriceService) private readonly dates: DatePriceService) {}
  @Post()
  start(@Req() request: SessionRequest, @Body(new ZodValidationPipe(DatePriceQuerySchema)) body: DatePriceQuery) { return this.dates.startDatePrices(request.sessionContext!, body).catch(repositoryHttpError); }
  @Get(':id')
  get(@Req() request: SessionRequest, @Param('id') id: string, @Query(new ZodValidationPipe(PollViewSchema)) view: z.infer<typeof PollViewSchema>) { return this.dates.getDatePrices(request.sessionContext!, id, view.clientGeneration).catch(repositoryHttpError); }
  @Delete(':id')
  cancel(@Req() request: SessionRequest, @Param('id') id: string, @Query(new ZodValidationPipe(PollViewSchema)) view: z.infer<typeof PollViewSchema>) { return this.dates.cancelDatePrices(request.sessionContext!, id, view.clientGeneration).catch(repositoryHttpError); }
}
