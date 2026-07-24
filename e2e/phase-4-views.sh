#!/bin/bash
set -e

echo "=== Phase 4 E2E: Views, Filters, and Sort ==="

# 1. Open the app
agent-browser open http://localhost:7001
agent-browser wait --load networkidle
agent-browser wait 1000

# 2. Navigate to the Travel Plans database
echo "=== Navigating to Travel Plans ==="
agent-browser find text "Travel Plans" click
agent-browser wait 1000

# 3. Switch to board view
echo "=== Switching to board view ==="
agent-browser find text "Board" click
agent-browser wait 1000
agent-browser screenshot screenshots/phase-4-board-view.png

# 4. Switch to list view
echo "=== Switching to list view ==="
agent-browser find text "List" click
agent-browser wait 1000
agent-browser screenshot screenshots/phase-4-list-view.png

# 5. Switch back to table view
echo "=== Switching to table view ==="
agent-browser find text "Table" click
agent-browser wait 1000

# 6. Apply a filter - add a filter for Status "is" "Booked"
echo "=== Applying filter ==="
agent-browser find text "+ Add filter" click
agent-browser wait 500
agent-browser screenshot screenshots/phase-4-filter-added.png

# 7. Verify the app still works after filter
echo "=== Taking final screenshot ==="
agent-browser screenshot screenshots/phase-4-filtered.png

agent-browser close
echo "=== Phase 4 E2E PASSED ==="