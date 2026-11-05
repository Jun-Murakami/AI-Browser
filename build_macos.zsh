#!/bin/zsh
# Tauri 版の macOS 配布用ビルド・配置スクリプト（zsh）
#
# DialogSuite の build_macos.zsh と同じ流れで、配布先だけ Firebase Hosting ではなく
# GitHub Releases にしている（OSS のため）。成果物は release/ に集め、最後に Windows で
# build_windows_release.ps1 を実行してからまとめてアップロードする（このフォルダは Windows と同期している）。
#
# - Electron 版と同じく Universal（aarch64 + x86_64）で 1 つの DMG にする
# - DMG を AI-Browser-<version>_mac_universal.dmg として release/ に置き、.sha256（+ .sha256.asc）を作る
#   （Electron 版のアップデータは "mac" を含む名前の DMG を拾い、.app を入れ替える）
# - アップデータ用の .app.tar.gz と .sig を latest.json の darwin-aarch64 / darwin-x86_64 に登録する
#
# 使い方: zsh build_macos.zsh [鍵のパス] [鍵のパスワード]

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

# .env（Apple の署名・公証、GPG の鍵）を読み込む。CRLF でも読めるようにする
if [ -f .env ]; then
  set -a
  source <(tr -d '\r' < .env)
  set +a
fi

VERSION=$(node -p "require('./package.json').version")
echo "AI-Browser v$VERSION (macOS)"

# ========= アップデータ用の署名鍵 =========
# 既定: リポジトリ直下 .tauri/myapp.key。第1引数で上書き可、第2引数はパスワード（省略可）
KEY_PATH="${1:-$SCRIPT_DIR/.tauri/myapp.key}"
if [ ! -f "$KEY_PATH" ]; then
  echo "[error] アップデータ署名鍵が見つかりません: $KEY_PATH" >&2
  exit 1
fi
export TAURI_SIGNING_PRIVATE_KEY="$KEY_PATH"
# この鍵はパスワード無し。ほかのプロジェクト用に ~/.zshrc などで TAURI_SIGNING_PRIVATE_KEY_PASSWORD が
# 設定されていると、それで復号しようとして失敗するので、第2引数が無ければ空で上書きする
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${2-}"

# ========= コード署名・公証 =========
# .env は Electron 版と同じ名前を使っているので、tauri build が読む名前に揃える。
#   DEVELOPER_ID_APP                    -> APPLE_SIGNING_IDENTITY（"Developer ID Application: " は無くても可）
#   APPLE_API_KEY_ID / APPLE_API_KEY_PATH / APPLE_API_ISSUER -> 公証（APPLE_API_KEY に Key ID を入れる）
if [ -z "${APPLE_SIGNING_IDENTITY-}" ] && [ -n "${DEVELOPER_ID_APP-}" ]; then
  case "$DEVELOPER_ID_APP" in
    "Developer ID Application:"*) export APPLE_SIGNING_IDENTITY="$DEVELOPER_ID_APP" ;;
    *) export APPLE_SIGNING_IDENTITY="Developer ID Application: $DEVELOPER_ID_APP" ;;
  esac
fi
if [ -n "${APPLE_API_KEY_ID-}" ]; then
  export APPLE_API_KEY="$APPLE_API_KEY_ID"
fi
if [ -z "${APPLE_SIGNING_IDENTITY-}" ]; then
  echo "[warn] APPLE_SIGNING_IDENTITY（.env の DEVELOPER_ID_APP）が無いため、署名なしでビルドします"
fi
CAN_NOTARIZE=0
if [ -n "${APPLE_API_KEY-}" ] && [ -n "${APPLE_API_KEY_PATH-}" ] && [ -n "${APPLE_API_ISSUER-}" ]; then
  CAN_NOTARIZE=1
else
  echo "[warn] 公証用の API キー（APPLE_API_KEY_ID / APPLE_API_KEY_PATH / APPLE_API_ISSUER）が揃っていません"
fi

echo "[1/5] Rust targets (aarch64 / x86_64)"
rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null

echo "[2/5] Build (universal, signed & notarized by tauri)"
# アプリ内のライセンス表示（src/renderer/src/assets/license.json）を更新
npm run licenses
# --ci: 対話入力をしない（パスワード無しの鍵で TAURI_SIGNING_PRIVATE_KEY_PASSWORD が無くても止まらない）
# createUpdaterArtifacts: アップデータ用の .sig はリリース時だけ作る（tauri.conf.json では無効）
npm run tauri build -- --target universal-apple-darwin --bundles app,dmg --ci \
  --config '{"bundle":{"createUpdaterArtifacts":true}}'

BUNDLE_DIR="src-tauri/target/universal-apple-darwin/release/bundle"
TGZ="$BUNDLE_DIR/macos/AI-Browser.app.tar.gz"
SIG="$TGZ.sig"
DMG=$(ls "$BUNDLE_DIR"/dmg/*_"$VERSION"_*.dmg | head -1)
for f in "$TGZ" "$SIG" "$DMG"; do
  if [ ! -f "$f" ]; then
    echo "[error] 成果物が見つかりません: $f" >&2
    exit 1
  fi
done

echo "[3/5] Notarize & staple DMG"
if [ "$CAN_NOTARIZE" = "1" ]; then
  xcrun notarytool submit "$DMG" \
    --key "$APPLE_API_KEY_PATH" \
    --key-id "$APPLE_API_KEY" \
    --issuer "$APPLE_API_ISSUER" \
    --wait
  xcrun stapler staple -v "$DMG"
else
  echo "  スキップ（公証用の API キーがありません）"
fi

echo "[4/5] Add to release/"
# 前のリリースの成果物を消してから置く（DialogSuite と同じく mac 側で先に掃除する）
node scripts/release-manifest.mjs clean
node scripts/release-manifest.mjs add --src "$DMG" --name "AI-Browser-${VERSION}_mac_universal.dmg" --kind installer --checksum
node scripts/release-manifest.mjs add --src "$TGZ" --name "AI-Browser_universal.app.tar.gz" --kind updater \
  --sig "$SIG" --platforms darwin-aarch64,darwin-x86_64

echo "[5/5] Done"
echo "- release/: $SCRIPT_DIR/release"
echo "
次の手順: Windows で build_windows_release.ps1 を実行すると、Windows 版を追加して
GitHub Releases に下書きとしてアップロードできます（mac だけ先に上げる場合は
'node scripts/release-manifest.mjs publish'）。
"
