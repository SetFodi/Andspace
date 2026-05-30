# Verify AndSpace Downloads

Use this guide to verify AndSpace `v0.1.0-alpha.9` release artifacts before
installing or sharing them.

Checksums confirm that the file you downloaded matches the published release
artifact. AndSpace is currently an unsigned prerelease alpha, so macOS may
show a first-launch warning even when the checksum is correct.

## Release

- GitHub release: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.9
- Platform focus: macOS first, Apple Silicon focused.

## Expected SHA-256 Checksums

```text
d2239e43f897e9dfc98477b3cb8d08cda68b465b229d18ac0d498690a2e94fcc  AndSpace-v0.1.0-alpha.9-macos.zip
36181540ddd9d39531746a5728bb45b9913942fff43398bc322b86547cc72881  AndSpace_0.1.0-alpha.9_aarch64.dmg
```

## Verify The ZIP

From the folder containing the downloaded ZIP:

```bash
shasum -a 256 AndSpace-v0.1.0-alpha.9-macos.zip
```

Expected output:

```text
d2239e43f897e9dfc98477b3cb8d08cda68b465b229d18ac0d498690a2e94fcc  AndSpace-v0.1.0-alpha.9-macos.zip
```

## Verify The DMG

From the folder containing the downloaded DMG:

```bash
shasum -a 256 AndSpace_0.1.0-alpha.9_aarch64.dmg
```

Expected output:

```text
36181540ddd9d39531746a5728bb45b9913942fff43398bc322b86547cc72881  AndSpace_0.1.0-alpha.9_aarch64.dmg
```

## If The Checksum Does Not Match

Do not run the app. Delete the file and download it again from the GitHub
release page. If the mismatch repeats, report it on GitHub:
https://github.com/SetFodi/Andspace/issues

## Install Warning

AndSpace `v0.1.0-alpha.9` is currently an unsigned prerelease alpha. macOS may
block first launch. This is expected for the current alpha distribution.

To open the app:

1. Move `AndSpace.app` to Applications.
2. Try to open it once.
3. If macOS blocks it, open System Settings -> Privacy & Security and choose
   Open Anyway for AndSpace.
4. You can also right-click `AndSpace.app` in Finder and choose Open.
