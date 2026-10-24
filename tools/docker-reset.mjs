import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
console.log('Explicit reset: deleting the current Compose project containers and database volume.');
const result = spawnSync('docker', ['compose', 'down', '--volumes'], { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
