import { Injectable } from '@nestjs/common';
import { CatalogSnapshotSchema } from '@torob-ticket/contracts';
import { catalogForIdentity } from '@torob-ticket/fixtures';
import type { SessionContext } from '../sessions/session-context';
import { sessionError } from '../sessions/session.service';
@Injectable()
export class CatalogService {
  get(context:SessionContext) {
    try { return CatalogSnapshotSchema.parse(catalogForIdentity(context.info.fixtureVersion,context.info.catalogRevision)); }
    catch { throw sessionError('NOT_FOUND',404); }
  }
}
