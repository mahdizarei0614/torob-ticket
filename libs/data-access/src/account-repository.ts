import { randomUUID } from 'node:crypto';
import { DemoIdentitySchema, SavedSearchSchema, SaveSearchInputSchema, type SaveSearchInput } from '@torob-ticket/contracts';
import { canonicalTransportQuery, canonicalValue } from '@torob-ticket/domain';
import type { Prisma, PrismaClient } from './generated/client';
import { RepositoryError, scopedTransaction, type DataScope } from './scope';
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const queryKey = (value: SaveSearchInput['query']) => canonicalValue(canonicalTransportQuery(value));
async function activeIdentity(tx: Prisma.TransactionClient, scope: DataScope) { const identity = await tx.demoIdentity.findUnique({ where: { sessionId: scope.sessionId } }); if (!identity?.signedIn)
    throw new RepositoryError('IDENTITY_REQUIRED'); return identity; }
/** Every account read/mutation shares the same session lock as reset/logout. */
export class AccountRepository {
    constructor(private readonly db: PrismaClient) { }
    state(scope: DataScope) { return scopedTransaction(this.db, scope, async (tx) => { const row = await tx.demoIdentity.findUnique({ where: { sessionId: scope.sessionId } }); return { identity: row?.signedIn ? DemoIdentitySchema.parse(row.payload) : null }; }); }
    signIn(scope: DataScope) { return scopedTransaction(this.db, scope, async (tx) => { const existing = await tx.demoIdentity.findUnique({ where: { sessionId: scope.sessionId } }); if (existing) {
        if (!existing.signedIn)
            await tx.demoIdentity.update({ where: { sessionId: scope.sessionId }, data: { signedIn: true } });
        return { identity: DemoIdentitySchema.parse(existing.payload) };
    } const identity = { identityId: randomUUID(), displayName: 'مسافر نمایشی', simulated: true as const }; await tx.demoIdentity.create({ data: { sessionId: scope.sessionId, id: identity.identityId, payload: identity, signedIn: true } }); return { identity }; }); }
    signOut(scope: DataScope) { return scopedTransaction(this.db, scope, async (tx) => { await tx.demoIdentity.updateMany({ where: { sessionId: scope.sessionId }, data: { signedIn: false } }); return { identity: null }; }); }
    list(scope: DataScope) { return scopedTransaction(this.db, scope, async (tx) => { const identity = await activeIdentity(tx, scope); const rows = await tx.savedSearch.findMany({ where: { sessionId: scope.sessionId, identityId: identity.id }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }); return { items: rows.map(row => SavedSearchSchema.parse(row.payload)) }; }); }
    get(scope: DataScope, id: string) { return scopedTransaction(this.db, scope, async (tx) => { const identity = await activeIdentity(tx, scope); const row = await tx.savedSearch.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } }); if (!row || row.identityId !== identity.id)
        throw new RepositoryError('NOT_FOUND'); return SavedSearchSchema.parse(row.payload); }); }
    save(scope: DataScope, input: SaveSearchInput, now: Date) { return scopedTransaction(this.db, scope, async (tx) => { const identity = await activeIdentity(tx, scope); const parsed = SaveSearchInputSchema.parse(input); const query = canonicalTransportQuery(parsed.query); const rows = await tx.savedSearch.findMany({ where: { sessionId: scope.sessionId, identityId: identity.id } }); const key = queryKey(query); const existing = rows.find(row => queryKey(SavedSearchSchema.parse(row.payload).query) === key); if (existing) {
        const saved = { ...SavedSearchSchema.parse(existing.payload), name: parsed.name };
        await tx.savedSearch.update({ where: { sessionId_id: { sessionId: scope.sessionId, id: existing.id } }, data: { payload: json(saved) } });
        return saved;
    } if (rows.length >= 20)
        throw new RepositoryError('SAVED_SEARCH_LIMIT'); const saved = SavedSearchSchema.parse({ savedSearchId: randomUUID(), identityId: identity.id, name: parsed.name, query, createdAt: now.toISOString() }); await tx.savedSearch.create({ data: { sessionId: scope.sessionId, id: saved.savedSearchId, identityId: identity.id, payload: json(saved), createdAt: now } }); return saved; }); }
    delete(scope: DataScope, id: string) { return scopedTransaction(this.db, scope, async (tx) => { const identity = await activeIdentity(tx, scope); const row = await tx.savedSearch.findUnique({ where: { sessionId_id: { sessionId: scope.sessionId, id } } }); if (!row || row.identityId !== identity.id)
        throw new RepositoryError('NOT_FOUND'); await tx.savedSearch.delete({ where: { sessionId_id: { sessionId: scope.sessionId, id } } }); return { deletedSavedSearchId: id }; }); }
}
