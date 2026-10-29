#!/bin/sh
set -eu
# The nested volume shields the Linux-generated client from the read-only host
# library tree. Regenerate on each explicit dev startup, never mutate host files.
node node_modules/prisma/build/index.js generate
exec "$@"
