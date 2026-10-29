import { lstat, mkdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';

/** A fresh checkout needs an empty mountpoint before its parent becomes read-only.
 * Generated client content belongs exclusively to the nested Linux volume. */
export async function prepareDevelopmentMountpoint(checkout) {
  const root = await realpath(checkout);
  const parent = await realpath(join(root, 'libs/data-access/src'));
  const within = relative(root, parent);
  if (isAbsolute(within) || within === '..' || within.startsWith('../') || within.startsWith('..\\')) throw new Error('Development mountpoint parent must stay inside the checkout.');
  const target = join(parent, 'generated');
  try { await mkdir(target); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const info = await lstat(target);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Development generated mountpoint must be a real directory.');
  return target;
}
