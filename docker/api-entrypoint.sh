#!/bin/sh
set -e

echo "== applying database schema (drizzle push) =="
cd /app/lib/db
npx drizzle-kit push --force --config ./drizzle.push.local.config.ts

echo "== seeding admin account (idempotent) =="
cd /app/artifacts/api-server
node src/seed-admin.mjs || true

echo "== starting api-server on port ${PORT:-5000} =="
exec node dist/index.mjs
