#!/bin/sh
set -e

# Merge stderr into stdout so every log line reaches CloudWatch
exec 2>&1

echo "=== container start: PORT=$PORT NODE_ENV=$NODE_ENV ==="

echo "Running database migrations..."
cd /app/packages/db
if ! ./node_modules/.bin/drizzle-kit migrate; then
  echo "ERROR: drizzle-kit migrate exited with code $?"
  exit 1
fi
echo "Migrations done."

echo "Starting API server..."
cd /app
exec bun run apps/api/src/index.ts
