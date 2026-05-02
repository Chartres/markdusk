# Markdusk Quick Look extension

A small macOS app extension (`.appex`) that lives inside `Markdusk.app/Contents/PlugIns/MarkduskQL.appex`. When loaded, it teaches Finder to render `.md` files with Markdusk's Smoke theme when the user presses Space.

This document describes the current state honestly: the source skeleton compiles and installs, but the resulting `.appex` does **not** currently load in Quick Look on macOS. See "Current limitations" below for why and "Future work" for the path to a fully working build.

## What is Quick Look?

Quick Look is the macOS built-in preview UI you get by selecting a file in Finder and pressing **Space** (or by running `qlmanage -p <path>` from the terminal). On modern macOS (12+), preview providers are app extensions registered with the `com.apple.quicklook.preview` extension point — small bundles that ship inside a host app's `Contents/PlugIns/` directory.

## How to test locally

1. Build the host app in debug mode:

   ```sh
   pnpm tauri build --debug
   ```

   This produces `target/debug/bundle/macos/Markdusk.app`.

2. Build and install the QL extension into that bundle:

   ```sh
   ./scripts/build-quicklook.sh
   ```

   The script compiles the Swift sources, assembles the `.appex` layout, copies it to `target/debug/bundle/macos/Markdusk.app/Contents/PlugIns/MarkduskQL.appex`, and asks Launch Services to register the host bundle.

3. Test with `qlmanage`:

   ```sh
   echo "# Hello Markdusk" > /tmp/test.md
   qlmanage -p /tmp/test.md          # interactive preview window
   # or, for a non-interactive thumbnail dump:
   mkdir -p /tmp/qltest
   qlmanage -t -s 600 -o /tmp/qltest /tmp/test.md
   open /tmp/qltest/test.md.png
   ```

4. Or use Finder: select a `.md` file and press **Space**.

If everything works, you see your file rendered with the Smoke palette (cream background, teal headings). If you see the default macOS plain-text rendering instead (raw `#`, `*` and backticks visible), the extension is not being picked up by Quick Look. See the next section.

## Current limitations (read this honestly)

This implementation is a working starting point but is **not** end-to-end functional today. Here is what works and what does not, with no sugar:

### What works

- The Swift source (`PreviewViewController.swift`) is a complete, valid `QLPreviewingController` implementation. It reads the file, runs a small block-level pass for ATX headings and fenced code blocks, uses `AttributedString(markdown:)` for inline emphasis, wraps everything in our Smoke CSS, and hands the HTML to a `WKWebView`.
- `scripts/build-quicklook.sh` compiles cleanly via `xcrun swiftc -Xlinker -bundle` and produces a Mach-O bundle (`filetype MH_BUNDLE`), which is the right binary type for an app-extension principal binary.
- The `.appex` is laid out correctly (`Contents/Info.plist`, `Contents/MacOS/MarkduskQL`, `Contents/Resources/smoke.css`).
- Launch Services picks up the extension. `lsregister -dump` lists it as a plugin of the host app, with the right `NSExtensionPointIdentifier` (`com.apple.quicklook.preview`) and supported types (`net.daringfireball.markdown`, `public.markdown`).

### What does not work (yet)

- **`pluginkit -m` does not list the extension.** Modern macOS QL preview providers are dispatched through pluginkit / ExtensionKit, not the legacy `.qlgenerator` mechanism. Even after `lsregister -f` and `pluginkit -a`, the extension does not show up in `pluginkit -m -p com.apple.quicklook.preview`.
- **Quick Look falls back to the default plain-text generator.** `qlmanage -t` produces a thumbnail of the raw markdown source (with `#`, `**`, backticks visible) on the system's default text background — not our themed HTML.

### Why

App extensions on modern macOS are not just Mach-O bundles. The principal binary is expected to be an XPC service stub that calls `NSExtensionMain` with the proper ExtensionKit metadata. Xcode's "App Extension" target template injects that stub at link time and generates additional metadata (entitlements, `_CodeSignature`, the EXAppExtensionAttributes used by ExtensionKit). `swiftc` invoked directly does not do any of this. The result compiles and links, but the system runtime never loads it.

Other ways the build can fail to load:

- **Unsigned or wrongly-signed binary.** The script does an ad-hoc-style build with no `codesign` step. Even an ad-hoc signature applied after the fact (`codesign -s - --deep --force ...`) is not enough on its own.
- **Quarantine.** If you ever copy the host bundle off-machine, Gatekeeper may add `com.apple.quarantine` and block plugin loading. Clear with:

  ```sh
  xattr -cr target/debug/bundle/macos/Markdusk.app
  ```

- **Renderer scope.** Even when the extension does load, the markdown renderer in `PreviewViewController.swift` is intentionally minimal: it handles ATX headings (`#`, `##`, ...), fenced code blocks (` ``` `), and inline emphasis through `AttributedString(markdown:)`. It does **not** render full GFM (no tables, lists, autolinks, task lists, footnotes, or HTML pass-through). For Quick Look-as-you-skim-Finder this is fine; for full preview parity with the in-app renderer, swap to `pulldown-cmark` via a Swift FFI bridge or pre-render to HTML in the host app.

## Future work — making this distributable

To turn this into a real, shippable Quick Look extension:

1. **Create an Xcode project** for `MarkduskQL` with the "App Extension" → "Quick Look Preview Extension" target template. This emits the right principal-binary stub, ExtensionKit metadata, and entitlement plist. The simplest path is `xcodegen` from a small `project.yml`; alternatively hand-write a `.xcodeproj` once and check it in.
2. **Replace `scripts/build-quicklook.sh`** with one that runs `xcodebuild -project qlextension/MarkduskQL.xcodeproj -scheme MarkduskQL -configuration Release` and then copies the resulting `.appex` into the host bundle.
3. **Codesign the whole bundle** with a Developer ID (`codesign --options=runtime --deep -s "Developer ID Application: ..."`). For Mac App Store distribution, use a "Mac Developer" identity instead and ensure the entitlements file matches Apple's QL extension template.
4. **Notarize and staple.** Submit `Markdusk.app` (with the `.appex` inside) to Apple's notary service, then `xcrun stapler staple Markdusk.app`. Without this, end users will hit Gatekeeper warnings when they first launch.
5. **Upgrade the renderer.** Replace the line-by-line block scanner with a real CommonMark/GFM pass — either by FFI'ing to the existing `markdusk-core` parser via a `cdylib`, or by exposing a Tauri command that returns themed HTML and having the extension hand off to the host app via XPC.

For a v0.1 ship that's not yet on the Mac App Store, an unsigned build with `xattr -cr` documented as a one-liner is acceptable for friends-and-family testing. For wider distribution, all five items above are required, and Apple Developer Program membership is mandatory for codesigning + notarization.
