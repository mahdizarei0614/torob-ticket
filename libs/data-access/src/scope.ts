import type { ApiErrorCode } from '@torob-ticket/contracts';
import type { Prisma, PrismaClient } from './generated/client';
/** Backend only: construct from authenticated SessionContext, never request input. */
export interface DataScope { readonly sessionId: string }
export class RepositoryError extends Error {
  constructor(readonly code: ApiErrorCode) { super(code); }
}
/** Serialize scoped mutations against reset/cleanup and revision changes. */
export async function scopedTransaction<T>(db: PrismaClient, scope: DataScope, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "DemoSession" WHERE id = ${scope.sessionId} FOR UPDATE`;
    if (!rows.length) throw new RepositoryError('SESSION_EXPIRED');
    return work(tx);
  });
}
