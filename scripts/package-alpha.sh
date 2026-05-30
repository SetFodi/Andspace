#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="$(node -e "const fs=require('fs'); process.stdout.write(JSON.parse(fs.readFileSync('package.json','utf8')).version)")"
BUNDLE_DIR="$ROOT_DIR/src-tauri/target/release/bundle"
MACOS_DIR="$BUNDLE_DIR/macos"
DMG_DIR="$BUNDLE_DIR/dmg"
APP_PATH="$MACOS_DIR/AndSpace.app"
ZIP_PATH="$MACOS_DIR/AndSpace-v${VERSION}-macos.zip"
CHECKSUM_PATH="$BUNDLE_DIR/AndSpace-v${VERSION}-checksums.txt"

run() {
  echo
  echo "==> $*"
  "$@"
}

sign_app_bundle() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 0
  fi

  echo
  echo "==> signing app bundle with local ad-hoc signature"
  xattr -cr "$APP_PATH" || true
  codesign --force --deep --sign - "$APP_PATH"
  codesign --verify --deep --strict --verbose=2 "$APP_PATH"
}

create_clean_dmg() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 0
  fi

  local dmg_path="$DMG_DIR/AndSpace_${VERSION}_aarch64.dmg"
  local source_dir

  source_dir="$(mktemp -d)"

  echo
  echo "==> creating clean DMG without a custom volume icon"
  rm -f "$dmg_path"
  ditto "$APP_PATH" "$source_dir/AndSpace.app"

  "$DMG_DIR/bundle_dmg.sh" \
    --volname "AndSpace" \
    --window-size 660 400 \
    --icon-size 128 \
    --text-size 16 \
    --icon "AndSpace.app" 180 170 \
    --app-drop-link 480 170 \
    --no-internet-enable \
    "$dmg_path" \
    "$source_dir"

  rm -rf "$source_dir"
}

run pnpm tsc --noEmit
run pnpm build
run cargo test --manifest-path src-tauri/Cargo.toml
run cargo check --manifest-path src-tauri/Cargo.toml
run scripts/verify-command-guard-zsh.sh
run scripts/test-server-detection.mjs
run scripts/test-pane-navigation.mjs
run scripts/test-workspace-persistence.mjs
run pnpm tauri build

if [[ ! -d "$APP_PATH" ]]; then
  echo "Missing app bundle: $APP_PATH" >&2
  exit 1
fi

sign_app_bundle
create_clean_dmg

rm -f "$ZIP_PATH"
(
  cd "$MACOS_DIR"
  ditto -c -k --sequesterRsrc --keepParent "AndSpace.app" "$ZIP_PATH"
)

artifacts=("$ZIP_PATH")
if [[ -d "$DMG_DIR" ]]; then
  while IFS= read -r dmg; do
    artifacts+=("$dmg")
  done < <(find "$DMG_DIR" -maxdepth 1 -type f -name "*.dmg" -print | sort)
fi

rm -f "$CHECKSUM_PATH"
for artifact in "${artifacts[@]}"; do
  if [[ -f "$artifact" ]]; then
    checksum="$(shasum -a 256 "$artifact" | awk '{print $1}')"
    printf "%s  %s\n" "$checksum" "$(basename "$artifact")" >> "$CHECKSUM_PATH"
  fi
done

echo
echo "Artifacts:"
echo "  app: $APP_PATH"
if [[ -d "$DMG_DIR" ]]; then
  find "$DMG_DIR" -maxdepth 1 -type f -name "*.dmg" -print | sort | sed 's/^/  dmg: /'
fi
echo "  zip: $ZIP_PATH"
echo "  checksums: $CHECKSUM_PATH"
