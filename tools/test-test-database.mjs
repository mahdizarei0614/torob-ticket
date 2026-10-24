import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { requireTestDatabaseUrl } from '../apps/api/test/test-database.cjs';

for (const url of [
  'postgresql://reviewer:local@127.0.0.1:5432/owned_test',
  'postgres://reviewer:local@localhost/ci_test',
]) {
  test(`accepts a dedicated PostgreSQL URL: ${url}`, () => assert.equal(requireTestDatabaseUrl(url), url));
}
for (const [name, url] of [
  ['missing', undefined], ['empty', ''], ['malformed', 'bad-url'],
  ['non-PostgreSQL scheme', 'https://localhost/owned_test'],
  ['no host', 'postgresql:///owned_test'],
  ['default database', 'postgresql://localhost'],
  ['non-test database', 'postgresql://localhost/production'],
  ['nested path', 'postgresql://localhost/production/owned_test'],
  ['encoded path separator', 'postgresql://localhost/production%2fowned_test'],
  ['query overrides database', 'postgresql://localhost/owned_test?database=production'],
  ['query overrides host', 'postgresql://localhost/owned_test?host=other'],
  ['fragment', 'postgresql://localhost/owned_test#ignored'],
]) {
  test(`rejects ${name} without echoing credentials`, () => {
    assert.throws(() => requireTestDatabaseUrl(url), error => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes('://'), 'Validation errors must not expose connection strings');
      return true;
    });
  });
}

for (const value of [undefined, 'postgresql://secret:private@localhost/production', 'postgresql://secret:private@localhost/owned_test?database=production']) {
  test(`setup rejects ${value === undefined ? 'missing test URL even with DATABASE_URL' : 'unsafe test URL'} before Prisma`, () => {
    const env = { ...process.env, DATABASE_URL: 'postgresql://secret:private@localhost/fallback_test' };
    delete env.TEST_DATABASE_URL;
    if (value !== undefined) env.TEST_DATABASE_URL = value;
    const result = spawnSync(process.execPath, ['tools/setup-test-database.mjs'], { encoding: 'utf8', env });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /TEST_DATABASE_URL/);
    assert.doesNotMatch(result.stderr, /secret|private|fallback_test|postgresql:\/\//);
  });
}
