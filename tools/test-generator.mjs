import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const temp = mkdtempSync(join(tmpdir(), 'torobticket-generator-'));
const generator = resolve('tools/generators/library/generate.mjs');
try {
  copyFileSync('tsconfig.base.json', join(temp, 'tsconfig.base.json'));
  copyFileSync('vitest.config.mts', join(temp, 'vitest.config.mts'));
  const run = (...args) => spawnSync(process.execPath, [generator, ...args], { cwd: temp, encoding: 'utf8' });
  assert.equal(run('example-helper', 'domain', 'shared').status, 0);
  const project = JSON.parse(readFileSync(join(temp, 'libs/example-helper/project.json'), 'utf8'));
  assert.deepEqual(project.tags, ['scope:shared', 'type:domain']);
  assert.equal(run('example-helper', 'domain', 'shared').status, 1);
  assert.equal(run('../escape', 'domain', 'shared').status, 1);
  assert.equal(run('raw-browser', 'provider', 'shared').status, 1);
  assert.match(readFileSync(join(temp, 'vitest.config.mts'), 'utf8'), /libs\/example-helper\/src\/\*\*\/\*\.spec\.ts/);
  console.log('PASS: library scaffold creates tagged targets and test discovery; rejects overwrites, traversal, and browser providers.');
} finally { rmSync(temp, { recursive: true, force: true }); }
