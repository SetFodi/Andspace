# Verify AndSpace Downloads

Use this guide to verify AndSpace `v0.1.0-beta.1` release artifacts before
installing or sharing them.

Checksums confirm that the file you downloaded matches the published release
artifact. AndSpace is currently an unsigned prerelease beta, so macOS may
show a first-launch warning even when the checksum is correct.

## Release

- GitHub release: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-beta.1
- Platform focus: macOS first, Apple Silicon focused.

## Expected SHA-256 Checksums

```text
9efdb0617763e4c8ce2dc04ddf605403e9a1fc30907777239399ee7648c99440  AndSpace-v0.1.0-beta.1-macos.zip
6d72c7f1dff0e1e9c6f7f7e3dd90e71feb3e77a71c3c2274a20484022073b31f  AndSpace_0.1.0-beta.1_aarch64.dmg
```

## Verify The ZIP

From the folder containing the downloaded ZIP:

```bash
shasum -a 256 AndSpace-v0.1.0-beta.1-macos.zip
```

Expected output:

```text
9efdb0617763e4c8ce2dc04ddf605403e9a1fc30907777239399ee7648c99440  AndSpace-v0.1.0-beta.1-macos.zip
```

## Verify The DMG

From the folder containing the downloaded DMG:

```bash
shasum -a 256 AndSpace_0.1.0-beta.1_aarch64.dmg
```

Expected output:

```text
6d72c7f1dff0e1e9c6f7f7e3dd90e71feb3e77a71c3c2274a20484022073b31f  AndSpace_0.1.0-beta.1_aarch64.dmg
```

## If The Checksum Does Not Match

Do not run the app. Delete the file and download it again from the GitHub
release page. If the mismatch repeats, report it on GitHub:
https://github.com/SetFodi/Andspace/issues

## Install Warning

AndSpace `v0.1.0-beta.1` is currently an unsigned prerelease beta. macOS may
block first launch. This is expected for the current beta distribution.

To open the app:

1. Move `AndSpace.app` to Applications.
2. Try to open it once.
3. If macOS blocks it, open System Settings -> Privacy & Security and choose
   Open Anyway for AndSpace.
4. You can also right-click `AndSpace.app` in Finder and choose Open.
