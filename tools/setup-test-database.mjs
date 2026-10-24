import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requireTestDatabaseUrl } from '../apps/api/test/test-database.cjs';

try {
  // Validate before running any Prisma command. DATABASE_URL is never a fallback.
  const connection = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const env = { ...process.env, DATABASE_URL: connection, TEST_DATABASE_URL: connection };
  for (const args of [['generate'], ['migrate', 'deploy'], ['db', 'seed']]) {
    console.log(`Test database setup: prisma ${args.join(' ')}`);
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], { cwd, env, stdio: 'inherit' });
  }
} catch (error) {
  // Validation contains no credentials; child commands already reported failures.
  console.error(error instanceof Error && !('status' in error) ? error.message : 'Test database initialization failed.');
  process.exitCode = 1;
}
