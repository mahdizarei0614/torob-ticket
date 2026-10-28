import { randomUUID } from 'node:crypto';
import { DemoIdentitySchema, type CreateDemoSessionInput, type SessionInfo } from '@torob-ticket/contracts';
import type { Prisma, PrismaClient } from './generated/client';
import { FOUNDATION_IDENTITY, type FixtureIdentity } from './prisma';
import { RepositoryError, scopedTransaction, type DataScope } from './scope';
export interface SessionResetOptions {scenarioRevision?:string;auditReason?:string}
export const SESSION_INACTIVITY_MS = 24 * 60 * 60 * 1000;
const sessionInclude = { fixture: true, identity: true } as const;
export type SessionRecord = Prisma.DemoSessionGetPayload<{ include: typeof sessionInclude }>;
export function sessionInfo(row: SessionRecord): SessionInfo {
  return { seed: Number(row.seed), anchorInstant: row.anchorInstant.toISOString(), scenario: row.scenario as SessionInfo['scenario'], fixtureVersion: row.fixtureVersion, catalogRevision: row.fixture.catalogRevision, mappingRevision: row.mappingRevision, scenarioRevision: row.scenarioRevision, expiresAt: row.expiresAt.toISOString(), identity: row.identity?.signedIn ? DemoIdentitySchema.parse(row.identity.payload) : null };
}
export class SessionRepository {
  constructor(private readonly db: PrismaClient, private readonly fixture:FixtureIdentity=FOUNDATION_IDENTITY) {}
  private async insert(tx: Prisma.TransactionClient, credentialHash: string, input: CreateDemoSessionInput, now: Date, scenarioRevision = 'scenario-v1') {
    const id = randomUUID();
    const mappingRevision = 'mapping-v1';
    return tx.demoSession.create({ data: { id, credentialHash, seed: BigInt(input.seed ?? 20261024), anchorInstant: new Date(input.anchorInstant ?? now.toISOString()), scenario: input.scenario ?? 'normal', scenarioRevision, fixtureVersion: this.fixture.fixtureVersion, mappingRevision, createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_INACTIVITY_MS), mappings: { create: { id: mappingRevision, patch: {}, createdAt: now } } }, include: sessionInclude });
  }
  create(credentialHash: string, input: CreateDemoSessionInput, now: Date) {
    return this.db.$transaction(tx => this.insert(tx, credentialHash, input, now));
  }
  async resolveAndTouch(credentialHash: string, now: Date): Promise<SessionRecord> {
    return this.db.$transaction(async tx => {
      // Atomic condition ensures expired sessions can never be revived by a touch.
      const touched = await tx.demoSession.updateMany({ where: { credentialHash, expiresAt: { gt: now } }, data: { lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_INACTIVITY_MS) } });
      if (!touched.count) throw new RepositoryError('SESSION_EXPIRED');
      return tx.demoSession.findUniqueOrThrow({ where: { credentialHash }, include: sessionInclude });
    });
  }
  reset(scope: DataScope, credentialHash: string, input: CreateDemoSessionInput, now: Date, options?:SessionResetOptions) {
    return scopedTransaction(this.db, scope, async tx => {
      const previous = options?.auditReason ? await tx.demoSession.findUniqueOrThrow({where:{id:scope.sessionId}}) : undefined;
      await tx.demoSession.delete({ where: { id: scope.sessionId } });
      const row = await this.insert(tx, credentialHash, input, now, options?.scenarioRevision);
      if(options?.auditReason) await tx.auditEvent.create({data:{sessionId:row.id,id:randomUUID(),kind:'admin-session-reset',payload:{reason:options.auditReason,previousRevision:previous!.scenarioRevision,revision:row.scenarioRevision},createdAt:now}});
      return row;
    });
  }
  async cleanup(now: Date): Promise<string[]> {
    return this.db.$transaction(async tx => {
      // One reviewer's cascade can outlive Prisma's default five-second interactive
      // transaction. Bound each collection job, instead of rolling back an entire backlog.
      await tx.$executeRaw`SET LOCAL statement_timeout = '25000ms'`;
      const expired = await tx.$queryRaw<{ id: string }[]>`
        WITH expired AS (
          SELECT id FROM "DemoSession"
          WHERE "expiresAt" <= ${now}
          ORDER BY "expiresAt", id
          LIMIT 1 FOR UPDATE SKIP LOCKED
        )
        DELETE FROM "DemoSession" AS session
        USING expired
        WHERE session.id = expired.id AND session."expiresAt" <= ${now}
        RETURNING session.id
      `;
      return expired.map(row => row.id);
    }, { maxWait: 2000, timeout: 30000 });
  }
  async appendAudit(scope: DataScope, kind: string, payload: Prisma.InputJsonValue, now: Date) {
    return scopedTransaction(this.db, scope, tx => tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind, payload, createdAt: now } }));
  }
  async getAudit(scope: DataScope, id: string) {
    const row = await this.db.auditEvent.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } });
    if (!row) throw new RepositoryError('NOT_FOUND');
    return row;
  }
  async applyMapping(scope: DataScope, baseRevision: string, patch: Prisma.InputJsonValue, now: Date) {
    return scopedTransaction(this.db, scope, async tx => {
      const row = await tx.demoSession.findUniqueOrThrow({ where: { id: scope.sessionId } });
      if (row.mappingRevision !== baseRevision) throw new RepositoryError('MAPPING_COLLISION');
      const revision = await tx.mappingRevision.create({ data: { sessionId: scope.sessionId, id: randomUUID(), parentId: baseRevision, patch, createdAt: now } });
      await tx.demoSession.update({ where: { id: scope.sessionId }, data: { mappingRevision: revision.id } });
      await tx.auditEvent.create({ data: { sessionId: scope.sessionId, id: randomUUID(), kind: 'mapping-applied', payload: { baseRevision, revision: revision.id, patch }, createdAt: now } });
      return revision;
    });
  }
}
