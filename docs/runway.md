# Markdusk — Public Release Runway

Steps to go from "works on my Mac" to "published on the internet."

Order matters — each step unblocks the next.

## 1. Install full Xcode

Mac App Store → install Xcode (~10 GB). Then:

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

This unblocks `xcodebuild`, which is needed for:
- Building the Quick Look extension (Plan 7 v2)
- Code signing and notarization tooling

You can confirm with:

```bash
xcrun --show-sdk-path
which xcodebuild
```

Both should resolve to paths under `/Applications/Xcode.app`.

## 2. Apple Developer Program

Sign up at <https://developer.apple.com/programs> ($99/year). You need an Apple ID first if you don't have one.

What this unlocks:
- Developer ID Application certificate — signs the app so Gatekeeper doesn't block users on first launch.
- Notarization — Apple's automated malware scan; required for "trust" without right-click → Open dance.
- Mac App Store distribution (optional).

While you wait for approval (typically same-day), you can keep developing locally with the free **Apple ID Personal Team** in Xcode for the QL extension.

## 3. Generate Tauri update-signing keypair

This is separate from Apple code signing. The Tauri updater verifies update integrity with this key.

```bash
pnpm tauri signer generate -w ~/.tauri/markdusk.key
```

It prints two values:
- A **pub key** — paste into `crates/markdusk-app/tauri.conf.json` replacing `YOUR_TAURI_UPDATER_PUBKEY`.
- A **priv key** in `~/.tauri/markdusk.key` — never commit. This becomes the GitHub Secret `TAURI_PRIVATE_KEY`.

You'll also be asked for an optional password. If you set one, it becomes `TAURI_KEY_PASSWORD`.

## 4. Configure the QL extension target

```bash
open qlextension/MarkduskQL.xcodeproj
```

In Xcode:
- Select the MarkduskQL target → **Signing & Capabilities**
- Set **Team** to your Apple ID Personal Team (until step 2 finishes) or your Developer ID team after.
- Close Xcode.

Then test the install path:

```bash
pnpm tauri build --debug
./scripts/build-quicklook.sh
qlmanage -p ~/some-test.md
```

If a themed preview opens (not the plain-text fallback), Quick Look is wired.

## 5. Add 9 GitHub Secrets

In your repo's **Settings → Secrets and variables → Actions**, add:

| Secret | What |
|---|---|
| `MAC_CERT_BASE64` | Developer ID cert exported from Keychain Access as `.p12`, then `base64 -i cert.p12 \| pbcopy` |
| `MAC_CERT_PASSWORD` | The password you set when exporting the `.p12` |
| `KEYCHAIN_PASSWORD` | Anything — used for the temporary keychain in CI |
| `APPLE_TEAM_ID` | 10-char team identifier (e.g. `ABCDE12345`) — find in Developer portal |
| `APPLE_SIGNING_IDENTITY` | Full identity string, e.g. `Developer ID Application: Your Name (ABCDE12345)` — `security find-identity -v -p codesigning` lists it |
| `APPLE_ID` | Apple ID email |
| `APPLE_PASSWORD` | App-specific password from <https://appleid.apple.com> (Sign-In and Security → App-Specific Passwords) |
| `TAURI_PRIVATE_KEY` | Contents of `~/.tauri/markdusk.key` from step 3 |
| `TAURI_KEY_PASSWORD` | The password you set in step 3 (empty string if none) |

## 6. Cut a release

```bash
# Bump version in three places (single source of truth doesn't exist yet —
# bump them together):
#   crates/markdusk-app/tauri.conf.json  → "version"
#   package.json                          → "version"
#   Cargo.toml                           → workspace.package.version

git add -A
git commit -m "chore: bump to v0.2.0"
git tag v0.2.0
git push --tags
```

The `release.yml` workflow fires on the tag push. CI:
1. Imports your Apple cert
2. Runs `pnpm install --frozen-lockfile`
3. Runs `./scripts/release.sh` — builds, signs, notarizes the app + DMG
4. Uploads `Markdusk.dmg`, `Markdusk.app.tar.gz`, and the `.sig` to a GitHub Release

Watch the Actions tab. Notarization typically takes 5-15 minutes; the workflow waits.

## 7. Host the update manifest

The updater plugin checks `https://markdusk.app/updates/{{target}}/{{arch}}/{{current_version}}` for a JSON response. Simplest hosting:

- **GitHub Pages** — serve a static `latest.json` from a `gh-pages` branch
- **Cloudflare Pages** — same but faster CDN
- **Your own webserver** — works fine

The schema is documented in `docs/release.md`. The `signature` field uses your Tauri-updater private key from step 3.

You can also script the manifest update as a final step in the release workflow that:
1. Downloads `Markdusk.app.tar.gz` and `.sig` from the release artifacts
2. Builds the JSON
3. Pushes it to wherever you're hosting

## What can be skipped

- **Step 4 (QL extension)**: skip if you don't care about Quick Look. The main app still installs fine without it.
- **Step 7 (auto-update)**: skip if you'd rather have users manually download new versions. Set `plugins.updater.active` to `false` in `tauri.conf.json`.
- **Step 2 (Developer Program)**: skip if you only ever want to use Markdusk on your own Mac. `xattr -cr Markdusk.app` clears the unsigned-app warning. But you said "share broadly" — so do this.

## Common rejections during notarization

- **Hardened runtime missing**: the entitlements.plist already enables it.
- **Insecure entitlements**: `disable-library-validation` is required because we embed the QL extension; Apple sometimes flags it. If they reject, switch to signing both the host and the extension with the same Developer ID and remove the disable.
- **Unsigned dylibs in the bundle**: Tauri 2 should handle this, but if a sub-binary slips through, `codesign --verify --deep` catches it locally before submission.

If notarization rejects, run `xcrun notarytool log <submission-id> --apple-id ... --password ... --team-id ...` to see the specific rejection.
