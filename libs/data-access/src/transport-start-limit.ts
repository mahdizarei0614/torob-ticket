import type { Prisma } from './generated/client';
import { RepositoryError, type DataScope } from './scope';

/** Caller holds DemoSession FOR UPDATE; internal evidence is not a ticket start. */
export async function assertTransportStartLimit(tx: Prisma.TransactionClient, scope: DataScope, now: Date) {
  const rows = await tx.$queryRaw<{ starts: bigint }[]>`
    SELECT COUNT(*) AS starts FROM "SearchRun" AS comparison
    WHERE comparison."sessionId" = ${scope.sessionId}
      AND comparison."createdAt" > ${new Date(now.getTime() - 10_000)}
      AND (comparison.snapshot ->> 'kind') IS DISTINCT FROM 'referral-recheck'
      AND NOT EXISTS (
        SELECT 1 FROM "DatePriceRun" AS dates
        WHERE dates."sessionId" = comparison."sessionId" AND dates.id = comparison.id
      )
  `;
  if (rows[0]!.starts >= 5n) throw new RepositoryError('SEARCH_LIMIT');
}
