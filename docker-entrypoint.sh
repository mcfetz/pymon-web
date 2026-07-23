#!/bin/sh
set -e

: "${PYMON_API_URL:=http://pymon-server:5000}"

echo "pymon-web: API backend → ${PYMON_API_URL}"

envsubst '${PYMON_API_URL}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
