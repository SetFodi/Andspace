# macOS Signing, Notarization, And Packaging

This document tracks what is needed to make AndSpace credible for public macOS
distribution.

Official references:

- Tauri macOS code signing:
  https://v2.tauri.app/distribute/sign/macos/
- Tauri DMG packaging:
  https://v2.tauri.app/distribute/dmg/
- Tauri environment variables:
  https://v2.tauri.app/reference/environment-variables/

## Current State

- Product name: `AndSpace`
- Bundle identifier: `com.andspace.desktop`
- Version: `0.1.0-alpha.8`
- Tauri bundle targets: `app` and `dmg`
- Icon config includes `src-tauri/icons/icon.icns`
- Current public alpha is not signed with a Developer ID.
- Current public alpha is not notarized.
- No Apple credentials are stored in this repo.

## Requirements

For public distribution outside the Mac App Store:

1. Enroll in the Apple Developer Program.
2. Create a `Developer ID Application` certificate.
3. Install the certificate in the macOS login keychain for local signing, or
   export it as a password-protected `.p12` for CI.
4. Configure notarization credentials using either App Store Connect API keys or
   an Apple ID app-specific password.
5. Build a signed and notarized `.app` / `.dmg`.
6. Verify the signed app and Gatekeeper assessment before publishing.

## Local Signing

List available signing identities:

```bash
security find-identity -v -p codesigning
```

Use the Developer ID identity for a local Tauri build:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
pnpm tauri build
```

You can also set `bundle.macOS.signingIdentity` in `tauri.conf.json`, but
environment variables are safer for public repos because they keep identity
selection outside source control.

## CI Signing Certificate

For CI, export the Developer ID certificate as a `.p12`, then base64 encode it:

```bash
openssl base64 -A -in DeveloperIDApplication.p12 -out certificate-base64.txt
```

Required environment variables:

```bash
export APPLE_CERTIFICATE="$(cat certificate-base64.txt)"
export APPLE_CERTIFICATE_PASSWORD="p12-export-password"
```

Optional explicit signing identity:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
```

Do not commit certificates, `.p12` files, API keys, passwords, or generated
keychains.

## Notarization Credentials

Tauri can notarize with either App Store Connect API credentials or Apple ID
credentials.

### App Store Connect API Key

Recommended for automation:

```bash
export APPLE_API_ISSUER="issuer-uuid"
export APPLE_API_KEY="KEYID12345"
export APPLE_API_KEY_PATH="/secure/path/AuthKey_KEYID12345.p8"
```

### Apple ID App-Specific Password

Useful for local/manual release builds:

```bash
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
```

If the Apple ID is attached to multiple teams, set:

```bash
export APPLE_PROVIDER_SHORT_NAME="provider-short-name"
```

## Build Commands

Build all configured bundles:

```bash
pnpm tauri build
```

Build only the DMG bundle when debugging packaging:

```bash
pnpm tauri build -- --bundles dmg
```

Build and package the alpha locally, including checksums:

```bash
scripts/package-alpha.sh
```

## Verification

Verify the `.app` signature:

```bash
codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/AndSpace.app
```

Ask Gatekeeper to assess the `.app`:

```bash
spctl --assess --type execute --verbose src-tauri/target/release/bundle/macos/AndSpace.app
```

Check notarization/stapling metadata after notarized builds:

```bash
xcrun stapler validate src-tauri/target/release/bundle/macos/AndSpace.app
xcrun stapler validate src-tauri/target/release/bundle/dmg/*.dmg
```

Inspect signing details:

```bash
codesign -dv --verbose=4 src-tauri/target/release/bundle/macos/AndSpace.app
```

## Current Missing Pieces

- Apple Developer Program membership confirmation.
- Developer ID Application certificate.
- Notarization credentials:
  - App Store Connect API issuer/key/key path, or
  - Apple ID, app-specific password, and team ID.
- Final signed/notarized artifact verification.
- Upload of signed/notarized DMG to the GitHub release.

Until those are configured, AndSpace should continue to be described as an
unsigned, not-notarized public alpha.
