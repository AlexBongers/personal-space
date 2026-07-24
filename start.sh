#!/bin/bash
set -e
echo "Starting Personal Space..."

# Start the server in background
npm run start -w personal-space-server &
SERVER_PID=$!

# Start the client dev server
npm run dev -w personal-space-client &
CLIENT_PID=$!

# Trap to kill both on exit
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null" EXIT

echo "Server starting on http://localhost:3001"
echo "Client starting on http://localhost:5173"
echo "Open http://localhost:5173 in your browser"

wait