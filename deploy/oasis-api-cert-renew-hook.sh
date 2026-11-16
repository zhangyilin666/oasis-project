#!/bin/sh
set -eu

# Certbot sets RENEWED_DOMAINS for the certificate that was actually renewed.
case " ${RENEWED_DOMAINS:-} " in
  *" 162.211.181.253 "*) ;;
  *) exit 0 ;;
esac

if /usr/bin/docker container inspect xiaoyi-api-api-1 >/dev/null 2>&1; then
  /usr/bin/docker exec xiaoyi-api-api-1 caddy reload --force --config /etc/caddy/Caddyfile
fi
