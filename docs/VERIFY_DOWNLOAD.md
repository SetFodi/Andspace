# Verify AndSpace Downloads

Use this guide to verify AndSpace `v0.1.0-alpha.7` release artifacts before
installing or sharing them.

Checksums confirm that the file you downloaded matches the published release
artifact. AndSpace is currently an unsigned prerelease alpha, so macOS may
show a first-launch warning even when the checksum is correct.

## Release

- GitHub release: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.7
- Platform focus: macOS first, Apple Silicon focused.

## Expected SHA-256 Checksums

```text
2a76eb64f3e56702c22a382c692cb7a59f6c30d4d32cdcb32c2352295fa6bb4e  AndSpace-v0.1.0-alpha.7-macos.zip
f3a05ea81c67a5961f8e2f4f29774468e5a7bb4035f34e2f2bf2528cd32e9d2c  AndSpace_0.1.0-alpha.7_aarch64.dmg
```

## Verify The ZIP

From the folder containing the downloaded ZIP:

```bash
shasum -a 256 AndSpace-v0.1.0-alpha.7-macos.zip
```

Expected output:

```text
2a76eb64f3e56702c22a382c692cb7a59f6c30d4d32cdcb32c2352295fa6bb4e  AndSpace-v0.1.0-alpha.7-macos.zip
```

## Verify The DMG

From the folder containing the downloaded DMG:

```bash
shasum -a 256 AndSpace_0.1.0-alpha.7_aarch64.dmg
```

Expected output:

```text
f3a05ea81c67a5961f8e2f4f29774468e5a7bb4035f34e2f2bf2528cd32e9d2c  AndSpace_0.1.0-alpha.7_aarch64.dmg
```

## If The Checksum Does Not Match

Do not run the app. Delete the file and download it again from the GitHub
release page. If the mismatch repeats, report it on GitHub:
https://github.com/SetFodi/Andspace/issues

## Install Warning

AndSpace `v0.1.0-alpha.7` is currently an unsigned prerelease alpha. macOS may
block first launch. This is expected for the current alpha distribution.

To open the app:

1. Move `AndSpace.app` to Applications.
2. Try to open it once.
3. If macOS blocks it, open System Settings -> Privacy & Security and choose
   Open Anyway for AndSpace.
4. You can also right-click `AndSpace.app` in Finder and choose Open.
