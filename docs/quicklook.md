# Markdusk Quick Look extension

A small macOS app extension (`.appex`) that lives inside `Markdusk.app/Contents/PlugIns/MarkduskQL.appex`. When loaded, it teaches Finder to render `.md` files with Markdusk's Smoke theme when the user presses Space.

## What is Quick Look?

Quick Look is the macOS built-in preview UI you get by selecting a file in Finder and pressing **Space** (or by running `qlmanage -p <path>` from the terminal). On modern macOS (12+), preview providers are app extensions registered with the `com.apple.quicklook.preview` extension point — small bundles that ship inside a host app's `Contents/PlugIns/` directory.

## How this build works

The extension is a real Xcode target. The `.xcodeproj` is generated on demand from `qlextension/project.yml` via [xcodegen](https://github.com/yonaskolb/XcodeGen) — only the spec is checked in, not the project. `xcodebuild` then produces `MarkduskQL.appex` with the principal-binary stub, ExtensionKit metadata, code signature, and entitlement plist that the system loader requires. Going through Xcode (rather than `swiftc` directly) is non-negotiable: bare `swiftc` builds compile and even pass `lsregister`, but `pluginkit` won't load them — Xcode injects link-time metadata that `swiftc` does not.

## Building locally (Personal Team / unsigned)

Prerequisites: full **Xcode** (not just Command Line Tools), `xcodegen`, and a host bundle to install into.

```sh
# one-time
brew install xcodegen
# requires full Xcode.app from the App Store, then:
sudo xcode-select --switch /Applications/Xcode.app

# build host bundle (5+ minutes on a cold cache)
pnpm tauri build --debug

# build, sign ad-hoc, install into the host bundle, register with Launch Services
./scripts/build-quicklook.sh
```

The script:

1. Runs `xcodegen` inside `qlextension/` to materialize `MarkduskQL.xcodeproj`.
2. Runs `xcodebuild ... -configuration Release` with `CODE_SIGN_IDENTITY="-"` (ad-hoc).
3. Copies the resulting `.appex` into `target/debug/bundle/macos/Markdusk.app/Contents/PlugIns/`.
4. Calls `lsregister -f` so Launch Services notices the new plugin.
5. Greps `pluginkit -m -p com.apple.quicklook.preview` for the extension as a sanity check.

If `pluginkit` doesn't list MarkduskQL after the script runs, the extension is built but the system refused to register it — almost always a signing issue. The fix is one Xcode UI step:

1. `open qlextension/MarkduskQL.xcodeproj`
2. Select the `MarkduskQL` target → **Signing & Capabilities** tab.
3. Set **Team** to your Apple ID (the "Personal Team" entry). Apple's free developer ID is enough for local builds — paid Developer Program membership is only needed for distribution.
4. Close Xcode, rerun `./scripts/build-quicklook.sh`.

Verify with:

```sh
echo "# Hello Markdusk" > /tmp/test.md
qlmanage -p /tmp/test.md       # interactive preview window
# or, for a non-interactive thumbnail dump:
mkdir -p /tmp/qltest
qlmanage -t -s 600 -o /tmp/qltest /tmp/test.md
open /tmp/qltest/test.md.png
```

If you see your file rendered with the Smoke palette (cream background, teal headings), the extension is working. If you see the default macOS plain-text rendering instead (raw `#`, `*` and backticks visible), see Troubleshooting.

## Building for distribution (Apple Developer Program required, ~$99/year)

Set the team and identity via env vars; the build script picks them up:

```sh
export MARKDUSK_TEAM_ID="ABCDE12345"
export MARKDUSK_SIGN_IDENTITY="Developer ID Application: Your Name (ABCDE12345)"
./scripts/build-quicklook.sh
```

Then notarize the **whole** host bundle (the extension rides along inside it):

```sh
ditto -c -k --sequesterRsrc --keepParent \
  target/debug/bundle/macos/Markdusk.app Markdusk.app.zip
xcrun notarytool submit Markdusk.app.zip \
  --apple-id "you@example.com" --password "app-specific-pwd" \
  --team-id "$MARKDUSK_TEAM_ID" --wait
xcrun stapler staple target/debug/bundle/macos/Markdusk.app
```

For a release build, swap `target/debug/bundle/macos/Markdusk.app` for `target/release/bundle/macos/Markdusk.app` and pass it as the first argument to `build-quicklook.sh`.

## Troubleshooting

- **`pluginkit -m` doesn't list MarkduskQL** — the most common cause is missing or wrong code signature. Open `qlextension/MarkduskQL.xcodeproj` in Xcode once and set Team in Signing & Capabilities (see "Building locally" above). After that, try `pluginkit -a target/debug/bundle/macos/Markdusk.app/Contents/PlugIns/MarkduskQL.appex -e use` to force-enable the extension. A logout/login or `killall -9 pluginkit` may also be needed to bust the cache.
- **`xcodebuild` errors with "tool 'xcodebuild' requires Xcode"** — you have Command Line Tools installed but not full Xcode. Install Xcode from the App Store, then `sudo xcode-select --switch /Applications/Xcode.app`.
- **"Code signing failed"** — verify `security find-identity -v -p codesigning` lists your identity. For Personal Team, refresh credentials in Xcode → Settings → Accounts → "Download Manual Profiles".
- **Markdusk preview renders empty / blank** — open `Console.app`, filter by process name `MarkduskQL`. Common cause: the WebView failed to load. The `project.yml` enables hardened runtime, which sandboxes the extension; that's expected and should be compatible with our `WKWebView` use.
- **Quarantine after copying off-machine** — Gatekeeper may add `com.apple.quarantine` and block plugin loading. Clear with `xattr -cr target/debug/bundle/macos/Markdusk.app`.
- **Renderer scope** — the markdown renderer in `PreviewViewController.swift` is intentionally minimal: ATX headings, fenced code blocks, and `AttributedString(markdown:)` for inline emphasis. No tables, lists, autolinks, footnotes, or HTML pass-through. For full GFM parity with the in-app renderer, swap to `pulldown-cmark` via a Swift FFI bridge or pre-render to HTML in the host app.

## Repo layout

```
qlextension/
├── project.yml                    # xcodegen spec (committed)
├── MarkduskQL.xcodeproj/          # generated by xcodegen (gitignored)
└── MarkduskQL/
    ├── Info.plist                 # NSExtensionPointIdentifier, principal class
    ├── Sources/
    │   └── PreviewViewController.swift   # QLPreviewingController impl
    └── Resources/
        └── smoke.css              # Smoke palette styles
scripts/
└── build-quicklook.sh             # generate → build → install → register
```
