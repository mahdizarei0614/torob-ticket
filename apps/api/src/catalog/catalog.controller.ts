import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../sessions/session.guard';
import type { SessionRequest } from '../sessions/session-context';
import { CatalogService } from './catalog.service';
@Controller('v1/catalog')
@UseGuards(SessionGuard)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog:CatalogService){}
  @Get()
  get(@Req() request:SessionRequest){return this.catalog.get(request.sessionContext!);}
}
