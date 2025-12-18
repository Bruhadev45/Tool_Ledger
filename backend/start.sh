#!/bin/sh
# Startup script for Railway/Docker deployment
# Runs database migrations before starting the application

set -e

echo "🚀 Starting ToolLedger Backend..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  WARNING: DATABASE_URL is not set. Skipping migrations."
else
  echo "📦 Running database migrations..."
  npx prisma migrate deploy || {
    echo "❌ Migration failed. Continuing anyway..."
  }
fi

echo "🎯 Starting application..."
exec npm run start:prod
