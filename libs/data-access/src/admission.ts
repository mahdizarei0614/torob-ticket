import type { Prisma } from './generated/client';
import { RepositoryError, type DataScope } from './scope';
/** Caller holds DemoSession FOR UPDATE: all provider/hotel work shares one bound. */
export async function assertSearchAdmission(tx: Prisma.TransactionClient, scope: DataScope) {
    const [transport, hotels] = await Promise.all([tx.searchRun.count({ where: { sessionId: scope.sessionId, status: 'collecting' } }), tx.hotelSearchRun.count({ where: { sessionId: scope.sessionId, payload: { path: ['phase'], equals: 'running' } } })]);
    if (transport + hotels >= 2)
        throw new RepositoryError('SEARCH_LIMIT');
}
