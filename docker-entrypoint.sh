#!/bin/sh
set -e
cd /app/apps/api

npx prisma migrate deploy

if [ "${RUN_SEED:-true}" = "true" ]; then
  npx tsx prisma/seed.ts
fi

exec "$@"
