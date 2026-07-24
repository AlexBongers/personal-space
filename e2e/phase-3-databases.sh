#!/bin/bash
set -e

echo "=== Phase 3 E2E: Databases ==="

# 1. Open the app
agent-browser open http://localhost:5173
agent-browser wait --load networkidle
agent-browser wait 1000

# 2. Navigate to the Travel Plans database
agent-browser find text "Travel Plans" click
agent-browser wait 1000
agent-browser screenshot screenshots/phase-3-table-view.png

# 3. Verify the table is visible with properties
echo "=== Verifying table properties ==="
agent-browser wait 500

# 4. Add a new property
echo "=== Adding new property ==="
agent-browser find text "+ Add property" click
agent-browser wait 500
agent-browser type "Notes"
agent-browser wait 300
agent-browser press "Enter"
agent-browser wait 1000

# 5. Add a new row
echo "=== Adding new row ==="
agent-browser find text "+ New" click
agent-browser wait 1000

# 6. Edit a cell - click the first row's title to edit
echo "=== Editing a cell ==="
agent-browser find text "Japan Trip" click
agent-browser wait 500
agent-browser type "Japan Trip 2026"
agent-browser wait 500
agent-browser press "Escape"
agent-browser wait 500

agent-browser screenshot screenshots/phase-3-after-edits.png

# 7. Navigate to a row page
echo "=== Opening row page ==="
agent-browser find text "Tokyo, Japan" click
agent-browser wait 1000

agent-browser screenshot screenshots/phase-3-row-page.png

# 8. Go back and verify persistence by refreshing
echo "=== Verifying persistence ==="
agent-browser open http://localhost:5173
agent-browser wait --load networkidle
agent-browser wait 1000
agent-browser find text "Travel Plans" click
agent-browser wait 1000

# Verify the table still shows properly after refresh
agent-browser screenshot screenshots/phase-3-after-refresh.png

agent-browser close
echo "=== Phase 3 E2E PASSED ==="
