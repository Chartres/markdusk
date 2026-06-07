# Markdusk Quick Look Implementation Plan (Plan 7 of 7)

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Pressing Space on a `.md` file in Finder shows a themed Markdusk preview.

**Architecture:** Modern macOS Quick Look uses `QLPreviewExtension` — a small Swift app extension that lives inside the host bundle at `Contents/PlugIns/MarkduskQL.appex`. The extension renders markdown via `WKWebView` with our Smoke CSS embedded. Build is a separate `xcodebuild` step orchestrated by `scripts/build-quicklook.sh`.

**Honest caveats up front:**
1. The extension only loads if the host app is registered with Launch Services (`lsregister`).
2. macOS may quarantine the bundle on first install. Right-click → Open or `xattr -cr` clears it.
3. For distribution to other users, the entire app needs codesigning + notarization. This plan ships a working *local* build only.
4. Tauri 2 doesn't bundle app extensions natively — we postprocess `Markdusk.app` after `pnpm tauri build`.

---

## Task 1 — Swift package skeleton

**Files:**
- Create: `qlextension/MarkduskQL/Package.swift`
- Create: `qlextension/MarkduskQL/Info.plist`
- Create: `qlextension/MarkduskQL/MarkduskQLEntry.swift`
- Create: `qlextension/MarkduskQL/PreviewViewController.swift`
- Create: `qlextension/MarkduskQL/Resources/smoke.css`

The extension is a single `QLPreviewProvider` that takes the file URL, reads the bytes, parses markdown into HTML using Apple's built-in `AttributedString(markdown:)` (available macOS 12+), wraps in our themed CSS, and returns to QL.

Note: `AttributedString(markdown:)` parses CommonMark inline syntax but not block-level (no headings, no fenced code). For Quick Look we want headings to be styled, so we'll do a minimal block-level pass ourselves: split on lines, recognize ATX headings and fenced code blocks, leave other lines as paragraphs that go through `AttributedString(markdown:)` for inline emphasis.

```swift
// qlextension/MarkduskQL/Sources/MarkduskQL/PreviewViewController.swift
import Cocoa
import Quartz
import WebKit

@objc(MarkduskQLPreview)
class PreviewViewController: NSViewController, QLPreviewingController {
    private var webView: WKWebView!

    override func loadView() {
        let v = NSView(frame: NSRect(x: 0, y: 0, width: 720, height: 900))
        webView = WKWebView(frame: v.bounds)
        webView.autoresizingMask = [.width, .height]
        v.addSubview(webView)
        self.view = v
    }

    func preparePreviewOfFile(at url: URL) async throws {
        let data = try Data(contentsOf: url)
        guard let source = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "Markdusk", code: 1)
        }
        let html = render(source)
        webView.loadHTMLString(html, baseURL: url.deletingLastPathComponent())
    }

    private func render(_ source: String) -> String {
        let body = renderBlocks(source)
        let css = bundledCSS()
        return """
        <!doctype html>
        <html><head><meta charset="utf-8"><style>\(css)</style></head>
        <body class="markdusk">\(body)</body></html>
        """
    }

    private func renderBlocks(_ source: String) -> String {
        var out = ""
        var inFence = false
        var fenceBuf = ""
        var fenceLang = ""
        for raw in source.components(separatedBy: "\n") {
            let line = raw
            if inFence {
                if line.hasPrefix("```") {
                    out += "<pre><code class=\"lang-\(fenceLang)\">\(escapeHTML(fenceBuf))</code></pre>"
                    inFence = false
                    fenceBuf = ""
                    fenceLang = ""
                } else {
                    if !fenceBuf.isEmpty { fenceBuf += "\n" }
                    fenceBuf += line
                }
                continue
            }
            if line.hasPrefix("```") {
                inFence = true
                fenceLang = String(line.dropFirst(3))
                continue
            }
            if let h = atxHeading(line) {
                out += "<h\(h.level)>\(escapeHTML(h.text))</h\(h.level)>"
                continue
            }
            if line.trimmingCharacters(in: .whitespaces).isEmpty {
                continue
            }
            // Inline syntax via AttributedString(markdown:)
            if let attr = try? AttributedString(markdown: line) {
                let html = String(NSAttributedString(attr).string)
                out += "<p>\(escapeHTML(html))</p>"
            } else {
                out += "<p>\(escapeHTML(line))</p>"
            }
        }
        if inFence {
            out += "<pre><code class=\"lang-\(fenceLang)\">\(escapeHTML(fenceBuf))</code></pre>"
        }
        return out
    }

    private func atxHeading(_ line: String) -> (level: Int, text: String)? {
        var hashes = 0
        for c in line { if c == "#" { hashes += 1 } else { break } }
        guard (1...6).contains(hashes), line.count > hashes else { return nil }
        let after = line.index(line.startIndex, offsetBy: hashes)
        let rest = String(line[after...]).trimmingCharacters(in: .whitespaces)
        if rest.isEmpty { return nil }
        return (hashes, rest)
    }

    private func escapeHTML(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    private func bundledCSS() -> String {
        guard let url = Bundle(for: type(of: self)).url(forResource: "smoke", withExtension: "css"),
              let css = try? String(contentsOf: url) else {
            return ""
        }
        return css
    }
}
```

The CSS file (`Resources/smoke.css`) contains the same body of CSS we ship in `markdusk-core::export::SMOKE_CSS` (or just copy-paste those bytes here for Quick Look's purposes; minor drift is OK). Keep it simple — light-mode only is fine for QL since QL itself isn't theme-aware in the user's "viewing" context.

`Info.plist` for the extension declares the preview provider:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>app.markdusk.QuickLook</string>
  <key>CFBundleName</key>
  <string>MarkduskQL</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionAttributes</key>
    <dict>
      <key>QLSupportedContentTypes</key>
      <array>
        <string>net.daringfireball.markdown</string>
        <string>public.markdown</string>
      </array>
      <key>QLSupportsSearchableItems</key>
      <false/>
    </dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.quicklook.preview</string>
    <key>NSExtensionPrincipalClass</key>
    <string>MarkduskQLPreview</string>
  </dict>
</dict>
</plist>
```

**Step 1 only** — write all the source files. No build attempt yet.

Commit: `feat(quicklook): Swift extension skeleton (sources only)`

---

## Task 2 — Build script via xcodebuild

**Files:**
- Create: `scripts/build-quicklook.sh`

**Reality:** Swift Package Manager can't produce app extensions directly. We need an Xcode project (`.xcodeproj` or `.xcworkspace`) with an "App Extension" target. We can either:
- (A) hand-write the project file
- (B) generate it from `Package.swift` via `swift package generate-xcodeproj` — DEPRECATED in newer Swift (5.7+)
- (C) script `xcodegen` from a YAML spec (third-party tool but well-maintained)
- (D) skip Xcode entirely and use `swiftc` to compile a `.appex` bundle directly with Apple-provided macOS frameworks

Path D is the lowest-dependency. The build script:
1. Compile MarkduskQLEntry.swift + PreviewViewController.swift with `swiftc -emit-library -emit-module -static-stdlib=false`
2. Output as `MarkduskQL.appex/Contents/MacOS/MarkduskQL` (executable bundle)
3. Copy `Info.plist` and `Resources/` into the .appex
4. (For local install) copy the resulting .appex into `target/release/bundle/macos/Markdusk.app/Contents/PlugIns/`
5. Run `lsregister -f` on the host bundle so macOS picks up the new extension

```bash
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

xcrun swiftc \
  -target arm64-apple-macos12.0 \
  -emit-executable \
  -framework AppKit \
  -framework Quartz \
  -framework WebKit \
  -framework Foundation \
  -bundle \
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
```

Make it executable: `chmod +x scripts/build-quicklook.sh`.

**Test:** Run `scripts/build-quicklook.sh` after `pnpm tauri build --debug`. Verify:
- `target/debug/bundle/macos/Markdusk.app/Contents/PlugIns/MarkduskQL.appex` exists
- `qlmanage -p /tmp/markdusk-test.md` (after creating a test file) renders something other than the default plain-text fallback

Honest expectation: this build path may not produce a loadable extension — Apple's app extension binary format has specific entry-point requirements that `swiftc -bundle` may not satisfy. If the extension doesn't load, document the failure mode and the path forward (Xcode project required).

Commit: `feat(quicklook): build script (xcodebuild path) and install into bundle`

---

## Task 3 — Documentation

**Files:**
- Create: `docs/quicklook.md`

A short doc explaining:
- What Quick Look is
- How to build the extension locally
- How to verify it works
- Known limitations (signing, Apple Developer Program, distribution)

Commit: `docs(quicklook): how-to + caveats`

---

## Closing

If Tasks 1-3 work end-to-end on the user's machine, append a Completion summary and call v1 shipped.

If the build script doesn't produce a loadable extension (likely — `swiftc -bundle` is finicky for app extensions), document the failure honestly in the Completion summary and propose Xcode-project path as future work.
