#!/bin/sh
set -eu
# Refresh only the Linux-owned client volume; outputs are container-local.
node node_modules/prisma/build/index.js generate
node node_modules/prisma/build/index.js migrate deploy
node tools/seed.mjs
