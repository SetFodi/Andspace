# Verify AndSpace Downloads

Use this guide to verify AndSpace `v0.1.0-alpha.6` release artifacts before
installing or sharing them.

Checksums confirm that the file you downloaded matches the published release
artifact. AndSpace is currently an unsigned prerelease alpha, so macOS may
show a first-launch warning even when the checksum is correct.

## Release

- GitHub release: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.6
- Platform focus: macOS first, Apple Silicon focused.

## Expected SHA-256 Checksums

```text
317afd38c3c19ce1c6cd7ba74e74f8677f16564c5c250ebaa06786e9bd3a7d9f  AndSpace-v0.1.0-alpha.6-macos.zip
f6dc8458b81a73d6aa759bec24af9ded231a81b1f84c09b28750892d8d020f5c  AndSpace_0.1.0-alpha.6_aarch64.dmg
```

## Verify The ZIP

From the folder containing the downloaded ZIP:

```bash
shasum -a 256 AndSpace-v0.1.0-alpha.6-macos.zip
```

Expected output:

```text
317afd38c3c19ce1c6cd7ba74e74f8677f16564c5c250ebaa06786e9bd3a7d9f  AndSpace-v0.1.0-alpha.6-macos.zip
```

## Verify The DMG

From the folder containing the downloaded DMG:

```bash
shasum -a 256 AndSpace_0.1.0-alpha.6_aarch64.dmg
```

Expected output:

```text
f6dc8458b81a73d6aa759bec24af9ded231a81b1f84c09b28750892d8d020f5c  AndSpace_0.1.0-alpha.6_aarch64.dmg
```

## If The Checksum Does Not Match

Do not run the app. Delete the file and download it again from the GitHub
release page. If the mismatch repeats, report it on GitHub:
https://github.com/SetFodi/Andspace/issues

## Install Warning

AndSpace `v0.1.0-alpha.6` is currently an unsigned prerelease alpha. macOS may
block first launch. This is expected for the current alpha distribution.

To open the app:

1. Move `AndSpace.app` to Applications.
2. Try to open it once.
3. If macOS blocks it, open System Settings -> Privacy & Security and choose
   Open Anyway for AndSpace.
4. You can also right-click `AndSpace.app` in Finder and choose Open.
