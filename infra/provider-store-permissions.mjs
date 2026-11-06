import { constants } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';

export async function prepareProviderStore(directory, uid, gid) {
  await mkdir(directory, { recursive: true });
  const folder = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    if (!(await folder.stat()).isDirectory()) throw new Error('Provider data must be a directory');
    await folder.chown(uid, gid);
    await folder.chmod(0o700);
    let file;
    try {
      file = await open(join(directory, 'provider.json'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    try {
      const metadata = await file.stat();
      if (!metadata.isFile() || metadata.nlink !== 1) throw new Error('Provider store must be a private regular file');
      await file.chown(uid, gid);
      await file.chmod(0o600);
    } finally { await file.close(); }
  } finally { await folder.close(); }
}
