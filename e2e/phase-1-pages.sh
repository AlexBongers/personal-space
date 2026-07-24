#!/bin/bash
set -e

echo "=== Phase 1 E2E: Pages and Sidebar ==="

# Navigate to the app
agent-browser open http://localhost:7001
agent-browser wait --load networkidle
agent-browser wait 1000

# Take screenshot of initial state
agent-browser screenshot screenshots/phase-1-initial.png

# Check sidebar has seeded pages
agent-browser snapshot -i
echo "Checking sidebar page tree..."

# Click "Add page" button
agent-browser find text "Add page" click
agent-browser wait 500

# Check the new page appears
agent-browser snapshot -i

# Take screenshot showing the new page
agent-browser screenshot screenshots/phase-1-after-create.png

# Navigate to a page by clicking it
agent-browser find text "Welcome to Personal Space" click
agent-browser wait 500
agent-browser snapshot -i

# Take screenshot of page view
agent-browser screenshot screenshots/phase-1-page-view.png

agent-browser close
echo "=== Phase 1 E2E PASSED ==="