#!/bin/bash
set -euo pipefail

# Required env vars for a real release:
#   APPLE_TEAM_ID            — 10-char Developer Team ID (e.g. ABCDE12345)
#   APPLE_SIGNING_IDENTITY   — full keychain identity name
#   APPLE_ID                 — Apple ID email
#   APPLE_PASSWORD           — app-specific password from appleid.apple.com
# Optional:
#   MARKDUSK_VERSION         — overrides version in tauri.conf.json

if [ -z "${APPLE_TEAM_ID:-}" ]; then
  echo "APPLE_TEAM_ID not set — building unsigned dev bundle"
  echo "For real release, see docs/release.md"
  pnpm tauri build --debug
  exit 0
fi

echo "==> Building release bundle"
pnpm tauri build

APP="target/release/bundle/macos/Markdusk.app"
DMG_DIR="target/release/bundle/dmg"

if [ ! -d "$APP" ]; then
  echo "Build did not produce $APP"
  exit 1
fi

echo "==> Building Quick Look extension"
./scripts/build-quicklook.sh "$APP"

echo "==> Signing $APP"
codesign --force --deep --options runtime \
  --entitlements crates/markdusk-app/entitlements.plist \
  --sign "$APPLE_SIGNING_IDENTITY" \
  --timestamp \
  "$APP"

echo "==> Verifying signature"
codesign --verify --deep --strict --verbose=2 "$APP"
spctl --assess --verbose=4 "$APP" || echo "spctl failed — expected if not yet notarized"

echo "==> Creating zip for notarization"
ZIP="target/release/Markdusk.zip"
ditto -c -k --keepParent "$APP" "$ZIP"

echo "==> Submitting for notarization"
xcrun notarytool submit "$ZIP" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "==> Stapling notarization ticket"
xcrun stapler staple "$APP"

echo "==> Verifying stapled bundle"
xcrun stapler validate "$APP"
spctl --assess --verbose=4 "$APP"

echo "==> Creating DMG"
mkdir -p "$DMG_DIR"
DMG="$DMG_DIR/Markdusk.dmg"
rm -f "$DMG"
hdiutil create \
  -volname "Markdusk" \
  -srcfolder "$APP" \
  -ov -format UDZO \
  "$DMG"

echo "==> Signing DMG"
codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$DMG"

echo "==> Notarizing DMG"
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"

echo ""
echo "==> Release complete: $DMG"
echo "    SHA256: $(shasum -a 256 "$DMG" | awk '{print $1}')"
