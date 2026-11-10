#!/usr/bin/env bash
# Build the Next.js standalone server and lay it out as a Lambda package in
# .lambda/web. The Lambda Web Adapter layer starts run.sh and proxies API
# Gateway requests to it on port 8080.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf .next .lambda/web
NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://zamu.prashantthakur.dev}" npx next build
mkdir -p .lambda/web
cp -r .next/standalone/. .lambda/web/
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
