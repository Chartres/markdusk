# Markdusk Distribution Plan (Plan 8 — final)

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Make Markdusk shippable to anyone on the internet. Sign, notarize, package as DMG, auto-update.

**Strategy:** All Apple-credential-bearing inputs are env vars. Scripts and CI run with placeholder values today and become real builds once the user pastes in their Developer Program credentials.

---

## Task 1 — Tauri config: signing scaffold

**File:** `crates/markdusk-app/tauri.conf.json`

Update the `bundle.macOS` block:

```json
"macOS": {
  "minimumSystemVersion": "12.0",
  "fileAssociations": [{ ... unchanged ... }],
  "hardenedRuntime": true,
  "entitlements": "entitlements.plist",
  "signingIdentity": "-",
  "providerShortName": null
}
```

Create `crates/markdusk-app/entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
</dict>
</plist>
```

(JIT and unsigned-memory entitlements are required for WKWebView's V8/JavaScriptCore inside a hardened-runtime context. `disable-library-validation` is needed because we'll embed the QL extension without re-signing.)

Tauri reads `signingIdentity` and `providerShortName` from env vars when set: `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`. Build verifies: `pnpm tauri build --debug` still works with the scaffold (signing="-" = ad-hoc).

Commit: `feat(dist): hardened-runtime entitlements + signing scaffold for tauri.conf.json`

---

## Task 2 — Release script

**File:** `scripts/release.sh`

```bash
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
```

Make executable: `chmod +x scripts/release.sh`.

Verify by running with no env vars: should fall back to `pnpm tauri build --debug` and exit cleanly.

Commit: `feat(dist): release script (build → sign → notarize → DMG → notarize)`

---

## Task 3 — Auto-update plumbing

**Files:**
- Modify: `crates/markdusk-app/Cargo.toml` — add `tauri-plugin-updater = "2"`
- Modify: `crates/markdusk-app/src/lib.rs` — register the plugin
- Modify: `package.json` — add `@tauri-apps/plugin-updater`
- Modify: `crates/markdusk-app/tauri.conf.json` — add updater config block
- Modify: `src/routes/App.svelte` — check for updates on launch

**Steps:**

- [ ] Install Rust dep:
  ```bash
  # in crates/markdusk-app/Cargo.toml [dependencies]
  tauri-plugin-updater = "2"
  ```

- [ ] Install JS dep:
  ```bash
  pnpm add @tauri-apps/plugin-updater
  ```

- [ ] In `tauri.conf.json` add:
  ```json
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["https://markdusk.app/updates/{{target}}/{{arch}}/{{current_version}}"],
      "dialog": true,
      "pubkey": "YOUR_TAURI_UPDATER_PUBKEY"
    }
  }
  ```

  Generate the pubkey/privkey pair once: `pnpm tauri signer generate -w ~/.tauri/markdusk.key`. Commit only the pubkey to `tauri.conf.json`; the privkey lives outside the repo and goes into the CI secret `TAURI_PRIVATE_KEY`. **For now**, leave `pubkey` as the literal `YOUR_TAURI_UPDATER_PUBKEY` placeholder — the user replaces it when they generate keys.

- [ ] Register the Rust plugin in `lib.rs`:
  ```rust
  .plugin(tauri_plugin_updater::Builder::new().build())
  ```

- [ ] In `App.svelte`'s onMount, add a non-blocking check:
  ```ts
  void (async () => {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update?.available) {
        // The dialog config above shows the native dialog; just trigger.
        await update.downloadAndInstall();
      }
    } catch {
      // Silent — no updater configured, or no network.
    }
  })();
  ```

- [ ] Verify `pnpm tauri build --debug` still succeeds.

- [ ] Document the release-manifest format the endpoint must serve:

  ```json
  {
    "version": "0.2.0",
    "notes": "Bug fixes and new features",
    "pub_date": "2026-05-08T12:00:00Z",
    "platforms": {
      "darwin-aarch64": {
        "signature": "...base64 signature...",
        "url": "https://github.com/.../Markdusk.app.tar.gz"
      },
      "darwin-x86_64": { ... }
    }
  }
  ```

Commit: `feat(dist): tauri-plugin-updater wired (endpoint + pubkey are placeholders)`

---

## Task 4 — GitHub Actions release workflow

**File:** `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    tags:
      - "v*"

jobs:
  release:
    runs-on: macos-14
    permissions:
      contents: write   # needed to upload the release asset
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2

      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - run: brew install xcodegen

      - name: Import Apple cert
        env:
          MAC_CERT_BASE64: ${{ secrets.MAC_CERT_BASE64 }}
          MAC_CERT_PASSWORD: ${{ secrets.MAC_CERT_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          echo "$MAC_CERT_BASE64" | base64 --decode > cert.p12
          security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security import cert.p12 -k build.keychain -P "$MAC_CERT_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain

      - run: pnpm install --frozen-lockfile

      - name: Build, sign, notarize
        env:
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          TAURI_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
        run: ./scripts/release.sh

      - uses: softprops/action-gh-release@v2
        with:
          files: |
            target/release/bundle/dmg/Markdusk.dmg
            target/release/bundle/macos/Markdusk.app.tar.gz
            target/release/bundle/macos/Markdusk.app.tar.gz.sig
```

The required GitHub Secrets the user must add later:
- `MAC_CERT_BASE64` — Developer ID cert exported as p12, base64-encoded
- `MAC_CERT_PASSWORD` — password for the p12
- `KEYCHAIN_PASSWORD` — anything; just used for the temporary keychain
- `APPLE_TEAM_ID`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` — as documented in the release script
- `TAURI_PRIVATE_KEY`, `TAURI_KEY_PASSWORD` — generated by `pnpm tauri signer generate`

Commit: `ci: release workflow (sign, notarize, GitHub Release on tag push)`

---

## Task 5 — Release docs

**File:** `docs/release.md`

Structure:

1. **Prerequisites** — Apple Developer Program membership, GitHub repo, secrets configured
2. **One-time setup** — generate Tauri updater keypair, export Developer ID cert as p12, add GitHub Secrets, replace `YOUR_TAURI_UPDATER_PUBKEY` in tauri.conf.json
3. **Cutting a release** — bump version in `crates/markdusk-app/tauri.conf.json` + `package.json` + `Cargo.toml` workspace.package.version, commit, `git tag v0.2.0 && git push --tags`. CI does the rest.
4. **Manual release (no CI)** — set the env vars locally, `./scripts/release.sh`, upload DMG to wherever
5. **Hosting the update manifest** — point the `endpoints` URL at a server that serves the manifest JSON. Simplest: GitHub Pages with a static `latest.json`. Show the JSON schema.
6. **Troubleshooting** — common notarization rejections (entitlement issues, hardened-runtime), keychain perm prompts in CI, expired cert.

Commit: `docs(dist): release procedure — sign, notarize, ship`

---

## Closing checklist

- [ ] `pnpm tauri build --debug` still succeeds with the new entitlements + signing scaffold
- [ ] `./scripts/release.sh` (no env vars) falls through to the dev build path cleanly
- [ ] `cargo test --workspace` and `pnpm test` still pass
- [ ] `cargo fmt`, `clippy`, `svelte-check` clean
- [ ] All scripts and configs committed
- [ ] `docs/release.md` covers the full procedure

When done, append a Completion summary. Markdusk v1 is shippable.
