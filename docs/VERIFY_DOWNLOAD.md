# Verify AndSpace Downloads

Use this guide to verify AndSpace `v0.1.0-beta.2` release artifacts before
installing or sharing them.

Checksums confirm that the file you downloaded matches the published release
artifact. AndSpace is currently an unsigned prerelease beta, so macOS may
show a first-launch warning even when the checksum is correct.

## Release

- GitHub release: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-beta.2
- Platform focus: macOS first, Apple Silicon focused.

## Expected SHA-256 Checksums

```text
766e12286a2fdf83350c370ae75ee032cef0814add8b863b627d7d0b98a98ab0  AndSpace-v0.1.0-beta.2-macos.zip
9ecd35d34265ad5a7366ccc9c6bcca6fd0e228825cf547c5d426ace3f36ffc64  AndSpace_0.1.0-beta.2_aarch64.dmg
```

## Verify The ZIP

From the folder containing the downloaded ZIP:

```bash
shasum -a 256 AndSpace-v0.1.0-beta.2-macos.zip
```

Expected output:

```text
766e12286a2fdf83350c370ae75ee032cef0814add8b863b627d7d0b98a98ab0  AndSpace-v0.1.0-beta.2-macos.zip
```

## Verify The DMG

From the folder containing the downloaded DMG:

```bash
shasum -a 256 AndSpace_0.1.0-beta.2_aarch64.dmg
```

Expected output:

```text
9ecd35d34265ad5a7366ccc9c6bcca6fd0e228825cf547c5d426ace3f36ffc64  AndSpace_0.1.0-beta.2_aarch64.dmg
```

## If The Checksum Does Not Match

Do not run the app. Delete the file and download it again from the GitHub
release page. If the mismatch repeats, report it on GitHub:
https://github.com/SetFodi/Andspace/issues

## Install Warning

AndSpace `v0.1.0-beta.2` is currently an unsigned prerelease beta. macOS may
block first launch. This is expected for the current beta distribution.

To open the app:

1. Move `AndSpace.app` to Applications.
2. Try to open it once.
3. If macOS blocks it, open System Settings -> Privacy & Security and choose
   Open Anyway for AndSpace.
4. You can also right-click `AndSpace.app` in Finder and choose Open.
