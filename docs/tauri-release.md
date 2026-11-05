# Tauri 版のリリース手順

DialogSuite（`D:\Synching\code\Tauri\DialogSuite`）と同じ仕組みで、配布先だけ GitHub Releases にしている（OSS のため）。

- 自動更新: tauri-plugin-updater。`latest.json` を GitHub Releases の最新リリースに添付し、
  アプリは `https://github.com/Jun-Murakami/AI-Browser/releases/latest/download/latest.json` を読む
- アップデータ署名: minisign。秘密鍵は `.tauri/myapp.key`（git 管理外）、公開鍵は `src-tauri/tauri.conf.json` の `plugins.updater.pubkey`
- Windows のコード署名: Azure Key Vault + AzureSignTool。`build_windows_release.ps1` が `--config` で `bundle.windows.signCommand` を
  絶対パスで付け、そこから `src-tauri/sign-azure.ps1` が呼ばれて本体 exe と MSI だけを署名する。
  `tauri.conf.json` には署名コマンドを書いていないので、素の `npm run build` は署名なしで通る
- macOS: Developer ID で署名し、`tauri build` が .app を公証、スクリプトが DMG を公証・staple する

## 事前準備

- `.tauri/myapp.key` … **紛失すると既存ユーザーに更新を届けられなくなる**のでバックアップしておく。
  パスワードを付けた鍵にする場合は、作り直して公開鍵を `tauri.conf.json` に入れ直し（最初のリリース前に限る）、
  ビルド時に `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` を設定する
- `.env`（Electron 版と同じ変数）
  - Windows: `AZURE_KEY_VAULT_URL` / `AZURE_KEY_VAULT_CERTIFICATE` / `AZURE_KEY_VAULT_TENANT_ID` / `AZURE_KEY_VAULT_CLIENT_ID` / `AZURE_KEY_VAULT_CLIENT_SECRET`
  - macOS: `DEVELOPER_ID_APP` / `APPLE_API_KEY_ID` / `APPLE_API_KEY_PATH` / `APPLE_API_ISSUER`
  - GPG（任意）: `GPG_SIGNING_KEY`。無ければ `.sha256` だけ作る
- Windows: PowerShell 7、AzureSignTool（`dotnet tool install --global AzureSignTool`）、GitHub CLI（`gh auth login` 済み）
- macOS: Xcode Command Line Tools、Rust の `aarch64-apple-darwin` / `x86_64-apple-darwin`（スクリプトが追加する）

## 手順

1. `package.json` の `version` を上げる（`tauri.conf.json` はこれを参照する）
2. macOS で `zsh build_macos.zsh`
   - `release/` を空にし、`AI-Browser-<version>_mac_universal.dmg`（+ `.sha256`）と
     アップデータ用の `AI-Browser_universal.app.tar.gz` を置き、`latest.json` に macOS を登録する
3. Windows で `pwsh ./build_windows_release.ps1`
   - MSI をビルド・署名し、`AI-Browser-<version>-setup_win_x64.msi`（+ `.sha256`）を置き、`latest.json` に Windows を登録する
   - リリースノートを入力する（`-ReleaseNotes` / `-ReleaseNotesFile` でも渡せる）
   - 最後に「GitHub Releases に下書きとしてアップロードしますか?」で `y` にすると、`gh` で下書きを作って上げる
   - 試験配布は `-Prerelease` を付ける。署名せずに確かめるだけなら `-SkipCodeSign`
4. GitHub の Releases で下書きを確認して公開する

`release/` は mac と Windows の間で同期しているフォルダに置かれる。手動で上げる場合は
`node scripts/release-manifest.mjs publish` でも同じ順序でアップロードできる。

## Electron 版からの移行に関わる決まりごと

- **リリース先とファイル名は Electron 版と同じ規則にする。** Electron 版のアプリ内アップデータは
  `releases/latest` を見て、Windows は名前に `setup_win` を含むもの、macOS は `mac` を含むものを選び、
  同名の `.sha256` で照合したうえでコード署名も確認してからインストールする
  （v1.7.2 の `src/renderer/src/components/UpdateDialog.tsx` と `src/main/index.ts` の `update:download`）
- macOS のアップデータ用アーカイブ（`.app.tar.gz`）の名前には `mac` を入れない（Electron 版が拾わないように）
- `.sig` はアップロードしない（中身は `latest.json` に入っている）
- 下書き・プレリリースは `releases/latest` に出ないので、公開するまで既存ユーザーには届かない
- Windows は旧版（ユーザー単位の NSIS、`%LOCALAPPDATA%\Programs\ai-browser`）と新版（マシン単位の MSI）が
  並んで残るため、Tauri 版の初回起動時に旧版のアンインストールを尋ねる。設定と履歴は先に引き継いでいる
- Linux 版（AppImage / deb）は未対応（計画書の Phase 7）。Linux の Electron 版ユーザーには、対応するまで新版が届かない
