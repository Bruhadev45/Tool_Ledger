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

# Check if dist directory exists
if [ ! -d "dist" ]; then
  echo "❌ ERROR: dist directory not found. Build may have failed."
  exit 1
fi

# Find main.js file (NestJS builds to dist/main.js)
MAIN_FILE="dist/main.js"
if [ ! -f "$MAIN_FILE" ]; then
  # Try alternative location
  if [ -f "dist/src/main.js" ]; then
    MAIN_FILE="dist/src/main.js"
  else
    echo "⚠️  WARNING: main.js not found in expected locations. Listing dist contents:"
    find dist -name "*.js" | head -10
    echo "❌ ERROR: Could not find main.js file"
    exit 1
  fi
fi

echo "✅ Found main file: $MAIN_FILE"
exec node "$MAIN_FILE"
