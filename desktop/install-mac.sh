#!/bin/sh
# Builds the Mac app and replaces the one in /Applications. Run from anywhere: npm run desktop:install
set -e
cd "$(dirname "$0")/.."
npm install
npm run desktop:build
osascript -e 'quit app "Personal Space"' 2>/dev/null || true
sleep 2
rm -rf "/Applications/Personal Space.app"
cp -R "release/mac-arm64/Personal Space.app" /Applications/
xattr -dr com.apple.quarantine "/Applications/Personal Space.app" 2>/dev/null || true
killall Dock 2>/dev/null || true
open "/Applications/Personal Space.app"
echo "Personal Space is bijgewerkt in /Applications."
