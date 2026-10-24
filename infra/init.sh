#!/bin/sh
set -eu
node node_modules/prisma/build/index.js migrate deploy
node dist/prisma/prisma/seed.js
