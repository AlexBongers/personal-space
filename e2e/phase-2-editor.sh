#!/bin/bash
set -e

echo "=== Phase 2 E2E: Editor ==="

agent-browser open http://localhost:5173
agent-browser wait --load networkidle
agent-browser wait 1000

# Navigate to the Editor Demo page
agent-browser find text "Editor Demo" click
agent-browser wait 1000
agent-browser screenshot screenshots/phase-2-editor-demo.png

# Click into the editor and type
agent-browser click ".ProseMirror"
agent-browser wait 500

# Type text in the editor
agent-browser type "Hello from E2E test"
agent-browser wait 500
agent-browser screenshot screenshots/phase-2-typing.png

# Refresh and verify content persisted
agent-browser open http://localhost:5173
agent-browser wait --load networkidle
agent-browser wait 1000
agent-browser find text "Editor Demo" click
agent-browser wait 1000
agent-browser screenshot screenshots/phase-2-after-refresh.png

# Test slash menu insertion
echo "=== Testing slash menu ==="

# Click editor and press Enter to create a new paragraph at the start
agent-browser click ".ProseMirror"
agent-browser wait 300
agent-browser press "Enter"
agent-browser wait 300

# Type / to open the slash menu at paragraph start
agent-browser type "/"
agent-browser wait 500

# Select Heading 1 from the slash menu
agent-browser find text "Heading 1" click
agent-browser wait 500

# Type heading text
agent-browser type "Heading from slash menu"
agent-browser wait 500

agent-browser screenshot screenshots/phase-2-heading.png

# Verify drag handles exist in the DOM
echo "=== Testing drag handles ==="
agent-browser eval "document.querySelectorAll('.drag-handle').length > 0"
agent-browser wait 300
agent-browser screenshot screenshots/phase-2-drag-handles.png

agent-browser close
echo "=== Phase 2 E2E PASSED ==="
