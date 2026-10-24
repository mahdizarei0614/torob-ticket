import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../libs/data-access/src/generated/client';
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
async function seed() {
try {
  // DO NOTHING is intentional: never update immutable roots during reseeding.
  await db.fixtureVersion.createMany({ data: [{ id: 'foundation-v1', catalogRevision: 'foundation-catalog-v1', manifest: { stage: 'foundation', inventory: 'authored-in-T05' }, createdAt: new Date('2026-10-24T00:00:00.000Z') }], skipDuplicates: true });
  console.log('Foundation fixture root ready; rich inventory belongs to T05.');
} finally { await db.$disconnect(); }
}
void seed().catch(error => { console.error(error); process.exitCode = 1; });
