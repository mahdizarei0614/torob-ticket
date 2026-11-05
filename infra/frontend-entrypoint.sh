#!/bin/sh
set -eu
TOROBTICKET_WEB_ORIGIN=${TOROBTICKET_SSO_ORIGIN:-http://localhost:4300}
TOROBTICKET_WEB_ORIGIN=${TOROBTICKET_WEB_ORIGIN%/}
if [ -z "${TOROBTICKET_ADMIN_ORIGIN:-}" ]; then
  scheme=${TOROBTICKET_WEB_ORIGIN%%://*}
  authority=${TOROBTICKET_WEB_ORIGIN#*://}
  case "$authority" in
    \[*\]*) hostname=${authority%%]*}] ;;
    *) hostname=${authority%%:*} ;;
  esac
  TOROBTICKET_ADMIN_ORIGIN="$scheme://$hostname:${TOROBTICKET_ADMIN_PORT:-4301}"
fi
TOROBTICKET_ADMIN_ORIGIN=${TOROBTICKET_ADMIN_ORIGIN%/}
export TOROBTICKET_WEB_ORIGIN TOROBTICKET_ADMIN_ORIGIN
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
