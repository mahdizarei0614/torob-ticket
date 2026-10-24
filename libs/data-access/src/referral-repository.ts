import { createHash, randomUUID } from 'node:crypto';
import type { ConfirmReferralInput } from '@torob-ticket/contracts';
import type { Prisma, PrismaClient } from './generated/client';
import { RepositoryError, scopedTransaction, type DataScope } from './scope';
export interface CreateReferralIntent {
  quoteId: string;
  quoteVersion: number;
  payload: Prisma.InputJsonValue;
  expiresAt: Date;
}
export class ReferralRepository {
  constructor(private readonly db: PrismaClient) {}
  createIntent(scope: DataScope, input: CreateReferralIntent, now: Date) {
    return scopedTransaction(this.db, scope, async tx => {
      const quote = await tx.quote.findUnique({ where: { sessionId_id_version: { sessionId: scope.sessionId, id: input.quoteId, version: input.quoteVersion } } });
      if (!quote) throw new RepositoryError('NOT_FOUND');
      if (quote.expiresAt <= now) throw new RepositoryError('QUOTE_EXPIRED');
      return tx.referralIntent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), ...input, createdAt: now } });
    });
  }
  async getIntent(scope: DataScope, id: string) {
    const row = await this.db.referralIntent.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
    if (!row) throw new RepositoryError('NOT_FOUND');
    return row;
  }
  async get(scope: DataScope, id: string) {
    const row = await this.db.referralEvent.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
    if (!row) throw new RepositoryError('NOT_FOUND');
    return row;
  }
  /** T11 supplies an already rechecked, eligible handoff payload; persist it exactly once. */
  confirm(scope: DataScope, input: ConfirmReferralInput, handoff: Prisma.InputJsonValue, now: Date) {
    const payloadHash = createHash('sha256').update(JSON.stringify([input.intentId, input.acceptedQuoteVersion])).digest('hex');
    return scopedTransaction(this.db, scope, async tx => {
      const previous = await tx.referralEvent.findUnique({ where: { sessionId_idempotencyKey: { sessionId: scope.sessionId, idempotencyKey: input.idempotencyKey } } });
      if (previous) {
        if (previous.payloadHash !== payloadHash) throw new RepositoryError('IDEMPOTENCY_CONFLICT');
        return previous;
      }
      const intent = await tx.referralIntent.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: input.intentId } } });
      if (!intent) throw new RepositoryError('NOT_FOUND');
      if (intent.expiresAt <= now) throw new RepositoryError('INTENT_EXPIRED');
      if (intent.quoteVersion !== input.acceptedQuoteVersion) throw new RepositoryError('QUOTE_CHANGED');
      const latest = await tx.quote.findFirst({ where: { sessionId: scope.sessionId, id: intent.quoteId }, orderBy: { version: 'desc' } });
      if (!latest || latest.version !== input.acceptedQuoteVersion) throw new RepositoryError('QUOTE_CHANGED');
      if (latest.expiresAt <= now) throw new RepositoryError('QUOTE_EXPIRED');
      // Event doubles as the idempotency record; unique key and payload commit together.
      return tx.referralEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), intentId: intent.id, idempotencyKey: input.idempotencyKey, payloadHash, payload: handoff, createdAt: now } });
    });
  }
}
