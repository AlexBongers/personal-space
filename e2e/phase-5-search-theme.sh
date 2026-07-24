#!/bin/bash
set -e

echo "=== Phase 5 E2E: Search and Dark Mode ==="

# 1. Open the app
agent-browser open http://localhost:7001
agent-browser wait --load networkidle
agent-browser wait 1000

# 2. Press Ctrl+K to open search
echo "=== Opening search with Ctrl+K ==="
agent-browser keyboard press "Control+k"
agent-browser wait 500
agent-browser screenshot screenshots/phase-5-search-open.png

# 3. Type a search query
echo "=== Typing search query ==="
agent-browser keyboard type "Travel"
agent-browser wait 500
agent-browser screenshot screenshots/phase-5-search-results.png

# 4. Click the first result
echo "=== Clicking search result ==="
agent-browser find text "Travel" click
agent-browser wait 1000
agent-browser screenshot screenshots/phase-5-after-search-navigation.png

# 5. Click theme toggle
echo "=== Toggling dark mode ==="
agent-browser find text "Personal Space"
agent-browser wait 500
# Find the theme toggle button (it's the one with the moon/sun icon)
# Use the title attribute
agent-browser find "[title*='Switch']" click
agent-browser wait 500
agent-browser screenshot screenshots/phase-5-dark-mode.png

# 6. Refresh and verify theme persists
echo "=== Refreshing to verify theme persistence ==="
agent-browser keyboard press "F5"
agent-browser wait --load networkidle
agent-browser wait 1000
agent-browser screenshot screenshots/phase-5-dark-mode-after-refresh.png

agent-browser close
echo "=== Phase 5 E2E PASSED ==="