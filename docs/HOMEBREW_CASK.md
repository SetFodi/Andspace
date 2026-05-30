# Homebrew Cask Preparation

Homebrew support is planned after a few public alpha releases stabilize. Do not
submit this to `homebrew-cask` yet; this is a draft for future tap/cask work.

## Current Artifact

- Version: `0.1.0-alpha.7`
- Release: https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.7
- DMG: `AndSpace_0.1.0-alpha.7_aarch64.dmg`
- SHA-256:
  `f3a05ea81c67a5961f8e2f4f29774468e5a7bb4035f34e2f2bf2528cd32e9d2c`

## Draft Cask

```ruby
cask "andspace" do
  version "0.1.0-alpha.7"
  sha256 "f3a05ea81c67a5961f8e2f4f29774468e5a7bb4035f34e2f2bf2528cd32e9d2c"

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

- This alpha is currently unsigned. Homebrew users may still see macOS
  first-launch warnings.
- Keep Homebrew wording aligned with `README.md`, `docs/VERIFY_DOWNLOAD.md`,
  and `docs/SECURITY_NOTES.md`.
- Revisit once the release cadence and artifact naming stay stable for several
  alpha releases.
