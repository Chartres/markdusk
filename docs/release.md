# Release procedure

How to ship a signed, notarized, auto-updating Markdusk build.

## Prerequisites

- Apple Developer Program membership ($99/yr) — needed for the Developer ID Application certificate and notarization.
- A GitHub repository with `Settings → Secrets and variables → Actions` access.
- macOS 14+ on the build machine (or rely on the GitHub Actions `macos-14` runner).
- `xcodegen` (`brew install xcodegen`) for the Quick Look extension.

## One-time setup

1. **Generate the Tauri updater keypair.**
   ```bash
   pnpm tauri signer generate -w ~/.tauri/markdusk.key
   ```
   This prints the public key. Replace `YOUR_TAURI_UPDATER_PUBKEY` in `crates/markdusk-app/tauri.conf.json` with that value (literal string, not a path). The matching private key (`~/.tauri/markdusk.key`) never leaves your machine — store it in 1Password and add its contents to the GitHub Secret `TAURI_PRIVATE_KEY`. If you set a passphrase, also add `TAURI_KEY_PASSWORD`.

2. **Export your Developer ID Application cert as `.p12`.**
   - In Keychain Access, find `Developer ID Application: Your Name (TEAMID)`.
   - Right-click → Export → save as `markdusk-cert.p12` with a password.
   - Convert to base64: `base64 -i markdusk-cert.p12 | pbcopy`.

3. **Add GitHub Secrets** (`Settings → Secrets → Actions → New repository secret`):
   | Name | Value |
   |------|-------|
   | `MAC_CERT_BASE64` | output of `base64 -i markdusk-cert.p12` |
   | `MAC_CERT_PASSWORD` | the password you set when exporting |
   | `KEYCHAIN_PASSWORD` | any random string (used for the temp keychain in CI) |
   | `APPLE_TEAM_ID` | 10-char team ID, e.g. `ABCDE12345` |
   | `APPLE_SIGNING_IDENTITY` | full identity name, e.g. `Developer ID Application: Your Name (ABCDE12345)` |
   | `APPLE_ID` | Apple ID email |
   | `APPLE_PASSWORD` | app-specific password from <https://appleid.apple.com> (not your Apple ID password) |
   | `TAURI_PRIVATE_KEY` | contents of `~/.tauri/markdusk.key` |
   | `TAURI_KEY_PASSWORD` | passphrase for the key (omit if none) |

4. **Decide where the update manifest lives.** See "Hosting the update manifest" below. Once you have the URL, update `plugins.updater.endpoints` in `crates/markdusk-app/tauri.conf.json`.

## Cutting a release

1. Bump the version in three places:
   - `Cargo.toml` (workspace `package.version`)
   - `package.json` (`version`)
   - `crates/markdusk-app/tauri.conf.json` (`version`)

2. Commit and push:
   ```bash
   git add -A && git commit -m "release: v0.2.0"
   git push
   ```

3. Tag and push the tag:
   ```bash
   git tag v0.2.0
   git push --tags
   ```

   The `Release` workflow runs on `macos-14`, signs and notarizes the bundle, and publishes a GitHub Release with the DMG plus `app.tar.gz` + `.sig` for the updater.

4. Update the manifest at your endpoint URL (see below) to point at the new release artifacts.

## Manual release (no CI)

```bash
export APPLE_TEAM_ID=ABCDE12345
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (ABCDE12345)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="abcd-efgh-ijkl-mnop"   # app-specific password
export TAURI_PRIVATE_KEY="$(cat ~/.tauri/markdusk.key)"
# export TAURI_KEY_PASSWORD="..."             # only if you set one
./scripts/release.sh
```

When it finishes, upload `target/release/bundle/dmg/Markdusk.dmg` to wherever you host downloads.

## Hosting the update manifest

`plugins.updater.endpoints` in `tauri.conf.json` is a templated URL. Tauri substitutes `{{target}}`, `{{arch}}`, `{{current_version}}` and expects a JSON manifest in this shape:

```json
{
  "version": "0.2.0",
  "notes": "Bug fixes and new features",
  "pub_date": "2026-05-08T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<base64 sig from app.tar.gz.sig>",
      "url": "https://github.com/<owner>/<repo>/releases/download/v0.2.0/Markdusk.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "<base64 sig from app.tar.gz.sig>",
      "url": "https://github.com/<owner>/<repo>/releases/download/v0.2.0/Markdusk.app.tar.gz"
    }
  }
}
```

**Simplest host:** GitHub Pages serving a static `latest.json`. After each release, regenerate the JSON (paste in the new `signature` and `url`) and push to the `gh-pages` branch. Point `endpoints` at `https://<owner>.github.io/<repo>/latest.json`.

The `signature` value goes inside the JSON literally, copied from `target/release/bundle/macos/Markdusk.app.tar.gz.sig` (single line of base64 produced by `pnpm tauri build`).

## Troubleshooting

- **"errSecInternalComponent" during codesign in CI** — the keychain isn't unlocked or the partition list isn't set. Re-check the `Import Apple cert` step ran without error and that `KEYCHAIN_PASSWORD` is consistent across the `create-keychain` / `unlock-keychain` / `set-key-partition-list` calls.

- **Notary rejects with "The binary uses an SDK older than the 10.9 SDK"** — usually an embedded dylib that wasn't signed. Re-run `codesign --verify --deep --strict` and address whatever the verifier complains about. The QL extension is the most common culprit.

- **Notary rejects with "The executable does not have the hardened runtime enabled"** — `entitlements.plist` missing or `--options runtime` flag missing. Check `crates/markdusk-app/tauri.conf.json` still has `"hardenedRuntime": true`.

- **Updater check silently does nothing** — `pubkey` is still the placeholder, or the endpoint returns non-200, or the network is offline. The `App.svelte` updater handler swallows errors on purpose; check the dev console (`pnpm tauri dev`) for the real reason.

- **"Developer ID certificate has expired"** — re-issue from <https://developer.apple.com/account/resources/certificates>, re-export, regenerate `MAC_CERT_BASE64`. Existing notarized builds remain valid; only new builds break.

- **`xcrun notarytool ... succeeds but `stapler staple` fails`** — the staple ticket can take a few seconds to propagate. The release script `--wait`s on submission, but if you ran the steps manually try again after a minute.
