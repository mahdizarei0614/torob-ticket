/* eslint @typescript-eslint/no-require-imports: off -- Shared synchronous boundary for Playwright's CommonJS config loader and its ESM reporter. */
const { existsSync, realpathSync } = require('node:fs');
const { homedir, tmpdir } = require('node:os');
const { basename, dirname, isAbsolute, relative, resolve, sep } = require('node:path');

/** Canonicalize a future run folder through its nearest existing ancestor. */
function canonicalEvidencePath(path) {
  let parent = resolve(path);
  const tail = [];
  while (!existsSync(parent)) {
    tail.unshift(basename(parent));
    const next = dirname(parent);
    if (next === parent) throw new Error('Evidence path has no existing ancestor');
    parent = next;
  }
  return resolve(realpathSync(parent), ...tail);
}

function evidencePathContains(root, path) {
  const child = relative(root, path);
  return child === '' || child !== '..' && !child.startsWith('..' + sep) && !isAbsolute(child);
}

/** A run may own a named child folder, never a broad source/evidence/home/temp tree. */
function evidenceRootPath(path, workspace = process.cwd()) {
  const root = canonicalEvidencePath(path);
  const protectedPaths = [workspace, homedir(), tmpdir(), '/tmp', resolve(workspace, 'docs/evidence'), resolve(workspace, 'docs/evidence/T30')];
  if (protectedPaths.some(anchor => evidencePathContains(root, canonicalEvidencePath(anchor)))) {
    throw new Error('E2E evidence must use a specific run folder, not a protected tree');
  }
  return root;
}

module.exports = { canonicalEvidencePath, evidencePathContains, evidenceRootPath };
