import { requireTestDatabaseUrl } from './test-database.cjs';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
describe('real PostgreSQL integration harness', () => {
  it('round-trips typed parameters and rolls back transaction-local state', async () => {
    const connectionString = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
    await client.connect();
    try {
      const before = await client.query<{ timezone: string }>('SHOW timezone');
      await client.query('BEGIN');
      await client.query("SET LOCAL TIME ZONE 'Asia/Tehran'");
      const result = await client.query<{ value: number; timezone: string }>("SELECT $1::integer AS value, current_setting('timezone') AS timezone", [42]);
      expect(result.rows).toEqual([{ value: 42, timezone: 'Asia/Tehran' }]);
      await client.query('ROLLBACK');
      expect((await client.query('SHOW timezone')).rows).toEqual(before.rows);
    } finally { await client.end(); }
  });
});
