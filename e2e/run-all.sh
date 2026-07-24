#!/bin/bash
set -e

echo "=== Personal Space E2E Tests ==="

# Start the app in background
npm run start &
APP_PID=$!

# Wait for app to be ready
echo "Waiting for app to start..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "App is ready. Running E2E tests..."

# Run Phase 1
bash e2e/phase-1-pages.sh

# Kill the app
kill $APP_PID 2>/dev/null || true
wait $APP_PID 2>/dev/null || true

echo "=== All E2E Tests PASSED ==="