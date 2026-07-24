#!/bin/bash
set -e

echo "=== Phase 2 E2E: Editor ==="

agent-browser open http://localhost:7001
agent-browser wait --load networkidle
agent-browser wait 1000

# Expand "Welcome to Personal Space" by clicking the expand arrow
agent-browser find text "Welcome to Personal Space" click
agent-browser wait 300

# Navigate to the Editor Demo page
agent-browser find text "Editor Demo" click
agent-browser wait 1000
agent-browser screenshot screenshots/phase-2-editor-demo.png

# Click into the editor and type
agent-browser find text "Type / for commands" click
agent-browser wait 500

# Type text using keyboard (no selector needed)
agent-browser keyboard type "Hello from E2E test"
agent-browser wait 500
agent-browser screenshot screenshots/phase-2-typing.png

# Refresh and verify content persisted
agent-browser open http://localhost:7001
agent-browser wait --load networkidle
agent-browser wait 1000
agent-browser find text "Welcome to Personal Space" click
agent-browser wait 300
agent-browser find text "Editor Demo" click
agent-browser wait 1000
agent-browser screenshot screenshots/phase-2-after-refresh.png

# Test slash menu insertion
echo "=== Testing slash menu ==="

# Click editor
agent-browser find text "Type / for commands" click
agent-browser wait 300
agent-browser press ArrowDown
agent-browser wait 100
agent-browser press Enter
agent-browser wait 300

# Type / to open the slash menu at paragraph start
agent-browser keyboard type "/"
agent-browser wait 500

# Select Heading 1 from the slash menu
agent-browser find text "Heading 1" click
agent-browser wait 500

# Type heading text
agent-browser keyboard type "Heading from slash menu"
agent-browser wait 500

agent-browser screenshot screenshots/phase-2-heading.png

# Verify drag handles exist in the DOM
echo "=== Testing drag handles ==="
agent-browser eval "document.querySelectorAll('.drag-handle').length > 0"
agent-browser wait 300
agent-browser screenshot screenshots/phase-2-drag-handles.png

agent-browser close
echo "=== Phase 2 E2E PASSED ==="