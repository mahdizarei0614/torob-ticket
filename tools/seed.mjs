import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'prisma/tsconfig.json'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/tsc-alias/dist/bin/index.js', '-p', 'prisma/tsconfig.json'], { stdio: 'inherit' });
execFileSync(process.execPath, ['dist/prisma/prisma/seed.js'], { stdio: 'inherit' });
