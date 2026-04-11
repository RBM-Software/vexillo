#!/bin/sh
set -e

echo "Running database migrations..."
cd /app
bunx drizzle-kit migrate --config packages/db/drizzle.config.ts

echo "Starting API server..."
exec bun run src/index.ts
