#!/bin/bash
set -euo pipefail

QL_DIR="qlextension/MarkduskQL"
HOST_APP=${1:-target/debug/bundle/macos/Markdusk.app}

if [ ! -d "$HOST_APP" ]; then
  echo "Host bundle not found: $HOST_APP"
  echo "Run 'pnpm tauri build --debug' first"
  exit 1
fi

OUT_APPEX="$HOST_APP/Contents/PlugIns/MarkduskQL.appex"
TMP=$(mktemp -d)
APPEX="$TMP/MarkduskQL.appex"
mkdir -p "$APPEX/Contents/MacOS" "$APPEX/Contents/Resources"

cp "$QL_DIR/Info.plist" "$APPEX/Contents/"
cp -R "$QL_DIR/Resources/" "$APPEX/Contents/Resources/" 2>/dev/null || true

# NOTE: swiftc has no top-level `-bundle` flag; we pass it through to the
# linker via `-Xlinker -bundle`. The result is a Mach-O bundle (filetype
# MH_BUNDLE) which is what app-extension binaries are. There is no `_main`
# symbol — the loader dispatches via NSExtensionMain through the principal
# class declared in Info.plist (MarkduskQLPreview).
xcrun swiftc \
  -target arm64-apple-macos12.0 \
  -framework AppKit \
  -framework Quartz \
  -framework WebKit \
  -framework Foundation \
  -Xlinker -bundle \
  -o "$APPEX/Contents/MacOS/MarkduskQL" \
  "$QL_DIR/Sources/MarkduskQL/PreviewViewController.swift" \
  "$QL_DIR/Sources/MarkduskQL/MarkduskQLEntry.swift"

mkdir -p "$HOST_APP/Contents/PlugIns"
rm -rf "$OUT_APPEX"
mv "$APPEX" "$OUT_APPEX"
echo "Installed at $OUT_APPEX"

LSREG=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
"$LSREG" -f "$HOST_APP" || true
echo "Registered with Launch Services."
