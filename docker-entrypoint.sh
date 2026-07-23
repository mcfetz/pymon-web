#!/bin/sh
set -e

: "${PYMON_API_URL:=http://pymon-server:5000}"

# Strip surrounding quotes that some container runtimes pass literally
PYMON_API_URL=$(echo "$PYMON_API_URL" | sed 's/^["'\'']*//;s/["'\'']*$//')

echo "pymon-web: API backend → ${PYMON_API_URL}"

envsubst '${PYMON_API_URL}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
