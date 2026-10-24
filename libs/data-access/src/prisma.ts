import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';
export const FOUNDATION_FIXTURE_VERSION = 'foundation-v1';
export const FOUNDATION_CATALOG_REVISION = 'foundation-catalog-v1';
export const REQUIRED_MIGRATIONS = ['0001_initial'];
export function createPrisma(connectionString: string): PrismaClient {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 3000 }) });
}
/** Readiness verifies usable storage, completed migrations, and the versioned seed. */
export async function checkDatabaseReady(db: PrismaClient): Promise<void> {
  await db.$queryRaw`SELECT 1`;
  const migrations = await db.$queryRaw<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
  if (REQUIRED_MIGRATIONS.some(name => !migrations.some(row => row.migration_name === name && row.finished_at && !row.rolled_back_at)) || migrations.some(row => !row.finished_at && !row.rolled_back_at)) throw new Error('Migrations are not ready');
  const fixture = await db.fixtureVersion.findUnique({ where: { id: FOUNDATION_FIXTURE_VERSION } });
  if (fixture?.catalogRevision !== FOUNDATION_CATALOG_REVISION) throw new Error('Foundation seed is not ready');
}
export type { PrismaClient } from './generated/client';
export type { Prisma } from './generated/client';
