# Verify AndSpace Downloads

Use this guide to verify AndSpace `v0.1.0-alpha.8` release artifacts before
installing or sharing them.

Checksums confirm that the file you downloaded matches the published release
artifact. AndSpace is currently an unsigned prerelease alpha, so macOS may
show a first-launch warning even when the checksum is correct.

## Release

- GitHub release: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.8
- Platform focus: macOS first, Apple Silicon focused.

## Expected SHA-256 Checksums

```text
c0845b48cb6239120d7f42905c4b4f371ed7eba8f8c1c86c704b39b27682d0d5  AndSpace-v0.1.0-alpha.8-macos.zip
650914ed22cb5cfad5ac27287b7f7273cd3438e2cdd96f977c287c85dd7db475  AndSpace_0.1.0-alpha.8_aarch64.dmg
```

## Verify The ZIP

From the folder containing the downloaded ZIP:

```bash
shasum -a 256 AndSpace-v0.1.0-alpha.8-macos.zip
```

Expected output:

```text
c0845b48cb6239120d7f42905c4b4f371ed7eba8f8c1c86c704b39b27682d0d5  AndSpace-v0.1.0-alpha.8-macos.zip
```

## Verify The DMG

From the folder containing the downloaded DMG:

```bash
shasum -a 256 AndSpace_0.1.0-alpha.8_aarch64.dmg
```

Expected output:

```text
650914ed22cb5cfad5ac27287b7f7273cd3438e2cdd96f977c287c85dd7db475  AndSpace_0.1.0-alpha.8_aarch64.dmg
```

## If The Checksum Does Not Match

Do not run the app. Delete the file and download it again from the GitHub
release page. If the mismatch repeats, report it on GitHub:
https://github.com/SetFodi/Andspace/issues

## Install Warning

AndSpace `v0.1.0-alpha.8` is currently an unsigned prerelease alpha. macOS may
block first launch. This is expected for the current alpha distribution.

To open the app:

1. Move `AndSpace.app` to Applications.
2. Try to open it once.
3. If macOS blocks it, open System Settings -> Privacy & Security and choose
   Open Anyway for AndSpace.
4. You can also right-click `AndSpace.app` in Finder and choose Open.
