import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from './generated/client';
import { RepositoryError, scopedTransaction, type DataScope } from './scope';
export interface CreateSearchRun {
  query: Prisma.InputJsonValue;
  clientGeneration: string;
  snapshot: Prisma.InputJsonValue;
  predecessorId?: string;
}
export interface AppendQuoteVersion {
  searchId: string;
  quoteId: string;
  expectedVersion: number;
  offerId: string;
  payload: Prisma.InputJsonValue;
  event: Prisma.InputJsonObject;
  expiresAt: Date;
}
export class SearchRepository {
  constructor(private readonly db: PrismaClient) {}
  create(scope: DataScope, input: CreateSearchRun, now: Date) {
    return scopedTransaction(this.db, scope, async tx => {
      if (input.predecessorId && !await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: input.predecessorId } } })) throw new RepositoryError('NOT_FOUND');
      const session = await tx.demoSession.findUniqueOrThrow({ where: { id: scope.sessionId } });
      return tx.searchRun.create({ data: { sessionId: scope.sessionId, id: randomUUID(), ...input, status: 'collecting', mappingRevision: session.mappingRevision, fixtureVersion: session.fixtureVersion, createdAt: now, updatedAt: now } });
    });
  }
  async get(scope: DataScope, id: string) {
    const run = await this.db.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
    if (!run) throw new RepositoryError('NOT_FOUND');
    return run;
  }
  appendQuoteVersion(scope: DataScope, input: AppendQuoteVersion, now: Date) {
    return scopedTransaction(this.db, scope, async tx => {
      const run = await tx.searchRun.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id: input.searchId } } });
      const offer = await tx.offerSnapshot.findFirst({ where: { sessionId: scope.sessionId, id: input.offerId, searchId: input.searchId } });
      if (!run || !offer) throw new RepositoryError('NOT_FOUND');
      const latest = await tx.quote.findFirst({ where: { sessionId: scope.sessionId, id: input.quoteId }, orderBy: { version: 'desc' } });
      if ((latest?.version ?? 0) !== input.expectedVersion || latest && latest.offerId !== input.offerId) throw new RepositoryError('QUOTE_CHANGED');
      const quote = await tx.quote.create({ data: { sessionId: scope.sessionId, id: input.quoteId, version: input.expectedVersion + 1, offerId: input.offerId, payload: input.payload, observedAt: now, expiresAt: input.expiresAt } });
      const last = await tx.searchEventRecord.aggregate({ where: { sessionId: scope.sessionId, searchId: input.searchId }, _max: { sequence: true } });
      const sequence = (last._max.sequence ?? 0) + 1;
      await tx.searchEventRecord.create({ data: { sessionId: scope.sessionId, searchId: input.searchId, sequence, payload: { ...input.event, searchId: input.searchId, clientGeneration: run.clientGeneration, sequence }, createdAt: now } });
      return quote;
    });
  }
}
