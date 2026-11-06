import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, symlink, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareProviderStore } from '../infra/provider-store-permissions.mjs';

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'torob-provider-permissions-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
const uid = process.getuid();
const gid = process.getgid();

test('provider migration preserves content and makes its directory and file private', () => fixture(async directory => {
  const file = join(directory, 'provider.json');
  await writeFile(file, '{"accounts":["retained"]}', { mode: 0o644 });
  await prepareProviderStore(directory, uid, gid);
  assert.equal(await readFile(file, 'utf8'), '{"accounts":["retained"]}');
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
}));

test('provider migration accepts a new empty directory', () => fixture(async directory => {
  await prepareProviderStore(join(directory, 'new'), uid, gid);
  assert.equal((await stat(join(directory, 'new'))).mode & 0o777, 0o700);
}));

test('provider migration rejects a symlink without changing its target', () => fixture(async directory => {
  const target = join(directory, 'outside.json');
  await writeFile(target, 'retained', { mode: 0o644 });
  await symlink(target, join(directory, 'provider.json'));
  await assert.rejects(prepareProviderStore(directory, uid, gid), { code: 'ELOOP' });
  assert.equal((await stat(target)).mode & 0o777, 0o644);
  assert.equal(await readFile(target, 'utf8'), 'retained');
}));

test('provider migration rejects a hard link without changing its target', () => fixture(async directory => {
  const target = join(directory, 'outside.json');
  await writeFile(target, 'retained', { mode: 0o644 });
  await link(target, join(directory, 'provider.json'));
  await assert.rejects(prepareProviderStore(directory, uid, gid), /private regular file/);
  assert.equal((await stat(target)).mode & 0o777, 0o644);
}));
