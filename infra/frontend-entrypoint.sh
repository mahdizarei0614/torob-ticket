#!/bin/sh
set -eu
canonical_origin() {
  set -- "$(printf '%s' "${1%/}" | tr '[:upper:]' '[:lower:]')"
  case "$1" in
    http://*:80) printf '%s' "${1%:80}" ;;
    https://*:443) printf '%s' "${1%:443}" ;;
    *) printf '%s' "$1" ;;
  esac
}
TOROBTICKET_WEB_ORIGIN=$(canonical_origin "${TOROBTICKET_SSO_ORIGIN:-http://localhost:4300}")
if [ -z "${TOROBTICKET_ADMIN_ORIGIN:-}" ]; then
  scheme=${TOROBTICKET_WEB_ORIGIN%%://*}
  authority=${TOROBTICKET_WEB_ORIGIN#*://}
  case "$authority" in
    \[*\]*) hostname=${authority%%]*}] ;;
    *) hostname=${authority%%:*} ;;
  esac
  TOROBTICKET_ADMIN_ORIGIN="$scheme://$hostname:${TOROBTICKET_ADMIN_PORT:-4301}"
fi
TOROBTICKET_ADMIN_ORIGIN=$(canonical_origin "$TOROBTICKET_ADMIN_ORIGIN")
TOROBTICKET_WEB_AUTHORITY=${TOROBTICKET_WEB_ORIGIN#*://}
TOROBTICKET_ADMIN_AUTHORITY=${TOROBTICKET_ADMIN_ORIGIN#*://}
export TOROBTICKET_WEB_ORIGIN TOROBTICKET_ADMIN_ORIGIN TOROBTICKET_WEB_AUTHORITY TOROBTICKET_ADMIN_AUTHORITY
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
