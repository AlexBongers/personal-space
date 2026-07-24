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

# Run Phase 2
echo "Running Phase 2..."
bash e2e/phase-2-editor.sh

# Run Phase 3
echo "Running Phase 3..."
bash e2e/phase-3-databases.sh

# Run Phase 4
echo "Running Phase 4..."
bash e2e/phase-4-views.sh

# Run Phase 5
echo "Running Phase 5..."
bash e2e/phase-5-search-theme.sh

# Kill the app
kill $APP_PID 2>/dev/null || true
wait $APP_PID 2>/dev/null || true

echo "=== All E2E Tests PASSED ==="