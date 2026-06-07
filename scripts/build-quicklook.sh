#!/bin/bash
set -euo pipefail

QL_DIR="qlextension"
HOST_APP=${1:-target/debug/bundle/macos/Markdusk.app}
TEAM_ID="${MARKDUSK_TEAM_ID:-}"        # e.g. ABCDE12345 once user has Developer Program
SIGN_IDENTITY="${MARKDUSK_SIGN_IDENTITY:--}"  # default '-' = ad-hoc

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen not found. Install with: brew install xcodegen"
  exit 1
fi

if [ ! -d "$HOST_APP" ]; then
  echo "Host bundle not found: $HOST_APP"
  echo "Run 'pnpm tauri build --debug' first"
  exit 1
fi

# Generate Xcode project
( cd "$QL_DIR" && xcodegen )

# Build the extension
BUILD_DIR=$(mktemp -d)
xcodebuild \
  -project "$QL_DIR/MarkduskQL.xcodeproj" \
  -scheme MarkduskQL \
  -configuration Release \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGN_IDENTITY="$SIGN_IDENTITY" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Manual \
  build

APPEX_PATH=$(find "$BUILD_DIR" -name "MarkduskQL.appex" -type d | head -n 1)
if [ -z "$APPEX_PATH" ] || [ ! -d "$APPEX_PATH" ]; then
  echo "Build did not produce MarkduskQL.appex"
  exit 1
fi

# Install into the host bundle
mkdir -p "$HOST_APP/Contents/PlugIns"
DEST="$HOST_APP/Contents/PlugIns/MarkduskQL.appex"
rm -rf "$DEST"
cp -R "$APPEX_PATH" "$DEST"
echo "Installed: $DEST"

# Re-register the host with Launch Services so the extension is discovered
LSREG=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
"$LSREG" -f "$HOST_APP" || true
echo "Registered with Launch Services."

# Show what pluginkit sees
pluginkit -m -p com.apple.quicklook.preview | grep -i markdusk || \
  echo "(pluginkit doesn't list MarkduskQL yet — may need a logout/login or run 'pluginkit -a $DEST -e use')"
