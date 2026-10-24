import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, copyFileSync, mkdirSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const temp = mkdtempSync(join(tmpdir(), 'torobticket-generator-'));
const generator = resolve('tools/generators/library/generate.mjs');
try {
  copyFileSync('tsconfig.base.json', join(temp, 'tsconfig.base.json'));
  copyFileSync('vitest.config.mts', join(temp, 'vitest.config.mts'));
  copyFileSync('nx.json', join(temp, 'nx.json'));
  copyFileSync('package.json', join(temp, 'package.json'));
  symlinkSync(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
  for (const [name, path] of [['web', 'apps/web'], ['admin', 'apps/admin'], ['api', 'apps/api'], ['e2e', 'tests/e2e']]) {
    mkdirSync(join(temp, path), { recursive: true });
    writeFileSync(join(temp, path, 'project.json'), JSON.stringify({ name, projectType: 'application' }));
  }
  const run = (...args) => spawnSync(process.execPath, [generator, ...args], { cwd: temp, encoding: 'utf8' });
  for (const name of ['web', 'admin', 'api', 'e2e']) {
    const beforeCollision = ['tsconfig.base.json', 'vitest.config.mts'].map(file => readFileSync(join(temp, file), 'utf8'));
    const collision = run(name, 'domain', 'shared');
    assert.equal(collision.status, 1, `Application name must be rejected: ${collision.stdout}${collision.stderr}`);
    assert.match(collision.stderr, new RegExp(`Nx project name '${name}' already exists`));
    assert.equal(existsSync(join(temp, `libs/${name}`)), false, 'Rejected collision must not create scaffold files');
    assert.deepEqual(['tsconfig.base.json', 'vitest.config.mts'].map(file => readFileSync(join(temp, file), 'utf8')), beforeCollision, 'Rejected collision must not mutate shared configuration');
  }
  assert.equal(run('example-helper', 'domain', 'shared').status, 0);
  const project = JSON.parse(readFileSync(join(temp, 'libs/example-helper/project.json'), 'utf8'));
  assert.deepEqual(project.tags, ['scope:shared', 'type:domain']);
  assert.equal(run('example-helper', 'domain', 'shared').status, 1);
  assert.equal(run('../escape', 'domain', 'shared').status, 1);
  assert.equal(run('raw-browser', 'provider', 'shared').status, 1);
  assert.match(readFileSync(join(temp, 'vitest.config.mts'), 'utf8'), /libs\/example-helper\/src\/\*\*\/\*\.spec\.ts/);
  console.log('PASS: library scaffold creates tagged targets and test discovery; rejects overwrites, traversal, browser providers, and application-name collisions before scaffold writes.');
} finally { rmSync(temp, { recursive: true, force: true }); }
