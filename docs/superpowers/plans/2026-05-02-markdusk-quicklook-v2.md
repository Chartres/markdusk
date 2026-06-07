# Markdusk Quick Look v2 (Plan 7 redo) — proper Xcode project

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Why this rewrite:** Plan 7 v1 used `swiftc` directly. macOS's modern ExtensionKit/pluginkit refuses to load extensions that lack the Info.plist + entitlement wiring Xcode injects at link time. v2 generates a real `.xcodeproj` via `xcodegen` and uses `xcodebuild`. The Swift sources from v1 carry over unchanged.

**Scope:** Make Quick Look work on the user's own Mac with their Apple ID Personal Team. Make the project ready for Developer ID signing once the user has the Apple Developer Program account.

---

## Task 1 — Reorganize sources for Xcode

**Files:**
- Move: `qlextension/MarkduskQL/Sources/MarkduskQL/PreviewViewController.swift` → `qlextension/MarkduskQL/Sources/PreviewViewController.swift`
- Move: `qlextension/MarkduskQL/Sources/MarkduskQL/MarkduskQLEntry.swift` → DELETE (Xcode handles entry-point linking)
- Keep: `qlextension/MarkduskQL/Info.plist`
- Keep: `qlextension/MarkduskQL/Resources/smoke.css`

The deleted entry file was a workaround for `swiftc` needing two source files; Xcode targets don't need it.

Commit after Task 4 — restructuring alone isn't a useful checkpoint.

---

## Task 2 — `project.yml` for xcodegen

**File:**
- Create: `qlextension/project.yml`

```yaml
name: MarkduskQL
options:
  bundleIdPrefix: app.markdusk
  deploymentTarget:
    macOS: "12.0"
  groupSortPosition: top
configs:
  Debug: debug
  Release: release
settings:
  base:
    SWIFT_VERSION: 5.9
    MACOSX_DEPLOYMENT_TARGET: "12.0"
    PRODUCT_BUNDLE_IDENTIFIER: app.markdusk.QuickLook
    DEVELOPMENT_TEAM: ""
    CODE_SIGN_STYLE: Automatic
    CODE_SIGN_IDENTITY: "-"
targets:
  MarkduskQL:
    type: app-extension.quicklook-preview
    platform: macOS
    sources:
      - path: MarkduskQL/Sources
      - path: MarkduskQL/Resources
        type: folder
    info:
      path: MarkduskQL/Info.plist
    settings:
      base:
        INFOPLIST_FILE: MarkduskQL/Info.plist
        ENABLE_HARDENED_RUNTIME: YES
        SWIFT_OBJC_BRIDGING_HEADER: ""
        SKIP_INSTALL: NO
```

Notes:
- `type: app-extension.quicklook-preview` is xcodegen's shorthand for the right product type (`com.apple.product-type.app-extension`) with the right `WrapperExtension` (`appex`).
- `DEVELOPMENT_TEAM: ""` and `CODE_SIGN_IDENTITY: "-"` mean *unsigned by default*; the user fills these in via Xcode UI or `xcodebuild` overrides.
- `ENABLE_HARDENED_RUNTIME: YES` is required for notarization later — no harm enabling it now.

---

## Task 3 — Build / install script

**File:**
- Modify: `scripts/build-quicklook.sh`

```bash
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
```

Notes:
- `xcodegen` is a `brew install xcodegen` dependency. It's a small, stable tool that's been the de facto Xcode-from-YAML for years.
- `MARKDUSK_TEAM_ID` and `MARKDUSK_SIGN_IDENTITY` are env-var overrides the user sets once they have Developer Program credentials.

---

## Task 4 — Update docs

**File:**
- Modify: `docs/quicklook.md`

Three sections:

### Building locally (Personal Team / unsigned)
```bash
brew install xcodegen
pnpm tauri build --debug
./scripts/build-quicklook.sh
```

Open `qlextension/MarkduskQL.xcodeproj` in Xcode once → Signing & Capabilities → set Team to your Apple ID → close. Re-run the script.

Verify with:
```bash
qlmanage -p some-file.md
```

If the Markdusk preview shows: working. If plain-text fallback: see Troubleshooting.

### Building for distribution (Developer Program required, ~$99/year)
```bash
export MARKDUSK_TEAM_ID="ABCDE12345"
export MARKDUSK_SIGN_IDENTITY="Developer ID Application: Your Name (ABCDE12345)"
./scripts/build-quicklook.sh
```

Then notarize the host bundle (this is for the whole `Markdusk.app`, not just the extension):
```bash
xcrun notarytool submit Markdusk.app.zip --apple-id ... --password ... --team-id "$MARKDUSK_TEAM_ID" --wait
xcrun stapler staple Markdusk.app
```

### Troubleshooting
- "pluginkit doesn't list MarkduskQL" → `pluginkit -a $HOST_APP/Contents/PlugIns/MarkduskQL.appex -e use`
- "Code signing failed" → verify `security find-identity -v -p codesigning` shows your identity; if Personal Team, use Xcode UI to refresh.
- "Markdusk preview is empty" → check `Console.app` for messages from process `MarkduskQL`. Common cause: missing `WKWebView` entitlement (rerun the build, the project.yml enables hardened runtime which sandboxes correctly).

---

## Closing checklist

- [ ] `xcodegen` produces a `.xcodeproj`
- [ ] `xcodebuild` builds `MarkduskQL.appex` without errors (signing may be ad-hoc)
- [ ] `.appex` lands inside `Markdusk.app/Contents/PlugIns/`
- [ ] `lsregister -f` registers the host bundle
- [ ] `pluginkit -m -p com.apple.quicklook.preview | grep markdusk` lists MarkduskQL (this is the "actually loads" gate)
- [ ] `qlmanage -p test.md` shows the themed preview (the user runs this; in CI we just check pluginkit registration)

If pluginkit lists it but `qlmanage` falls back, that's a runtime issue — the doc covers troubleshooting. If pluginkit doesn't list it at all, signing is required: switch to Apple ID Personal Team in Xcode.

---

When done, append a Completion summary. If pluginkit lists it after the build, declare v1.0 of Markdusk shipped.
