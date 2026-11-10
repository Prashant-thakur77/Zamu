#!/usr/bin/env bash
# Build the Next.js standalone server and lay it out as a Lambda package in
# .lambda/web. The Lambda Web Adapter layer starts run.sh and proxies API
# Gateway requests to it on port 8080.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf .next .lambda/web
# Empty values override .env.local, so local mock switches never reach AWS.
NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://zamu.prashantthakur.dev}" \
  NEXT_PUBLIC_MOCK_NIMIQ= MOCK_PAYOUTS= npx next build
# Refuse to ship a bundle whose wallet code was compiled with the mock on.
# (The localhost/LAN pattern only survives compilation when the mock flag is on.)
if grep -rqF '192\.168\.' .next/static/chunks; then
  echo "Mock wallet is compiled in. Aborting." >&2
  exit 1
fi
mkdir -p .lambda/web
cp -r .next/standalone/. .lambda/web/
rm -f .lambda/web/.env .lambda/web/.env.*
mkdir -p .lambda/web/.next
cp -r .next/static .lambda/web/.next/static
[ -d public ] && cp -r public .lambda/web/public || true
cat > .lambda/web/run.sh <<'RUN'
#!/bin/bash
export PORT=8080 HOSTNAME=0.0.0.0 NODE_ENV=production
exec node server.js
RUN
chmod +x .lambda/web/run.sh
du -sh .lambda/web
