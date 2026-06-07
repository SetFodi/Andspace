# Homebrew Cask Preparation

Homebrew support is planned after a few public beta releases stabilize. Do not
submit this to `homebrew-cask` yet; this is a draft for future tap/cask work.

## Current Artifact

- Version: `0.1.0-beta.2`
- Release: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-beta.2
- DMG: `AndSpace_0.1.0-beta.2_aarch64.dmg`
- SHA-256:
  `9ecd35d34265ad5a7366ccc9c6bcca6fd0e228825cf547c5d426ace3f36ffc64`

## Draft Cask

```ruby
cask "andspace" do
  version "0.1.0-beta.2"
  sha256 "9ecd35d34265ad5a7366ccc9c6bcca6fd0e228825cf547c5d426ace3f36ffc64"

  url "https://github.com/SetFodi/Andspace/releases/download/v#{version}/AndSpace_#{version}_aarch64.dmg"
  name "AndSpace"
  desc "Terminal-first macOS workspace for local development"
  homepage "https://andspace.app"

  depends_on macos: ">= :ventura"
  depends_on arch: :arm64

  app "AndSpace.app"

  zap trash: [
    "~/Library/Application Support/AndSpace",
  ]
end
```

## Notes Before Publishing

- This beta is currently unsigned. Homebrew users may still see macOS
  first-launch warnings.
- Keep Homebrew wording aligned with `README.md`, `docs/VERIFY_DOWNLOAD.md`,
  and `docs/SECURITY_NOTES.md`.
- Revisit once the release cadence and artifact naming stay stable for several
  beta releases.
