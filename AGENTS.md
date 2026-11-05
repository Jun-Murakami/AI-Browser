# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要な指示

**このリポジトリで作業する際は、必ず日本語で回答してください。**

## プロジェクト概要

AI Browser は、複数の AI チャットサービス（ChatGPT、Claude、Gemini 等）とターミナルを 1 画面にまとめた Tauri 2 製のデスクトップアプリです。
React の UI と、AI サービスごとの WebView をタブで切り替えて使い、エディタのプロンプトを 1 つまたは全サービスへ送信できます。

Electron 版は v1.7.2 で終了し、Tauri 版へ移行した（経緯と各フェーズの記録は `docs/tauri-migration-plan.md`）。

## 開発コマンド

```bash
npm run dev           # tauri dev（Vite の開発サーバー + アプリ。src-tauri の変更で自動再ビルド）
npm run devtools      # React DevTools（スタンドアロン版、別ターミナルで実行）

npm run lint          # Biome
npm run lint:fix
npm run format
npm run typecheck     # TypeScript（ネイティブ版 tsc）
(cd src-tauri && cargo test)   # Rust の単体テスト

npm run build         # 署名なしのインストーラを作る（コントリビューター向け）
npm run build:win     # 配布用（Windows、署名あり）: build_windows_release.ps1
npm run build:mac     # 配布用（macOS、署名・公証あり）: build_macos.zsh
npm run licenses      # アプリ内のライセンス表示（src/renderer/src/assets/license.json）を更新
```

配布の手順は `docs/tauri-release.md`。

## 構成

```
src-tauri/                 Rust（Tauri 2）
  src/lib.rs               起動、ウィンドウ生成、コマンド登録、状態の保存
  src/views.rs             AI サービスの子 WebView（生成・切替・リサイズ・送信）
  src/state.rs             appState.json / logs.json の読み書きと検証
  src/terminal.rs          ターミナル（portable-pty）とクリップボード画像
  src/keys.rs              表示中のタブへのキー送出
  src/updater.rs           アプリ内アップデート（tauri-plugin-updater）
  src/migrate.rs           Electron 版からのデータ移行と旧版のアンインストール案内
  tauri.conf.json          設定（multiwebview のため tauri は unstable フィーチャー）
  capabilities/            IPC は UI の WebView（label: "ui"）だけに許可
  sign-azure.ps1           Windows のコード署名ラッパー
src/renderer/              React UI（Vite の root。設定は vite.config.ts）
  src/services/bridge.ts   Rust とのやり取り（appBridge / terminalBridge）
  src/services/terminalService.ts  xterm.js の管理
  src/components/ hooks/ stores/ theme/
src/shared/                定義（browsers.ts / terminals.ts）と送信スクリプト（scripts/browserScripts.ts）
scripts/                   リリース補助（release-manifest.mjs、sign-artifacts.cjs）
```

### 技術スタック

- Tauri 2.12 + Rust（WebView2 / WKWebView / WebKitGTK）
- React 19 + TypeScript 7（ネイティブ版 tsc）、Vite 8、MUI 9
- Monaco Editor、xterm.js + portable-pty、Zustand、Biome

## 重要な設計

1. **マルチ WebView**: ウィンドウ `main` に UI の WebView `ui` を全面に置き、AI サービスごとの子 WebView `svc-<ID>` を
   `Window::add_child` で重ねる。表示中以外のタブは `hide()`。子 WebView の位置は UI から届く表示領域の大きさで決める（上端 108px）
2. **bridge.ts のコマンドキュー**: Tauri の async コマンドは呼び出し順に実行されるとは限らないので、戻り値を使わない呼び出し
   （タブ切替・サイズ・送信・設定保存）は 1 本のキューで順に実行する。表示領域の大きさは `init` の完了後に最新値だけ送る
3. **テキスト送信**: 送信スクリプト（`src/shared/scripts/browserScripts.ts`）はレンダラーで組み立てて Rust に渡し、
   送信先の判定と `eval_with_callback` は Rust 側で行う。サイトの DOM 変更で壊れやすいので、送信ボタンは有効になるまで待ってから押す
4. **キー送出**: Windows は WebView2 の DevTools Protocol（`Input.dispatchKeyEvent`）で本物のキー入力として送る。
   macOS / Linux は暫定で JS の KeyboardEvent
5. **Rust 側の注意**:
   - WebView を作る・触るコマンドは async にする（同期コマンドはメインスレッドで動き、デッドロックすることがある）
   - ミューテックスを持ったまま WebView のメソッドを呼ばない（メインスレッドの `on_page_load` と取り合う）
   - Windows では全 WebView が同じ `additional_browser_args` を使う必要がある（WebView2 環境の共有）
6. **ウィンドウの位置・大きさ・最大化**: tauri-plugin-window-state（DialogSuite と同じ）が物理座標で保存・復元する
   （拡大率の違うモニターをまたいでも戻る）。プラグインに保存が無い初回だけ appState.json の `bounds`（Electron 版から引き継いだ値）を使う。
   UI の読み込み後に表示するため、`StateFlags::VISIBLE` は外している
7. **Electron 版からの移行**: 初回起動時に Electron 版の userData から appState.json / logs.json を、
   Local Storage（LevelDB）から Nani! の翻訳履歴を引き継ぐ。リリースのファイル名は v1.7.2 のアップデータが拾える規則に揃えてある

### 状態管理（Zustand）

- `stores/useEditorStore.ts` - エディタ値（5 つの分割エディタ）
- `stores/useBrowserLoadingStore.ts` - ブラウザタブの読み込み状態
- ストアの値は個別セレクタで取得する（例: `useEditorStore((s) => s.editorValues[0])`）。オブジェクト全体を取ると不要な再レンダリングが起きる
- タブ管理・ログ管理は従来のカスタムフック（`useTabManager`, `useLogManager`）

## 開発時の注意事項

- コードスタイル: スペース 2 つ、シングルクォート、Biome のフォーマットに従う、TypeScript は strict
- パスエイリアス: `@renderer/*`、`@/*` → `src/renderer/src/*`
- 開発中に UI がリロードされる（Vite の HMR で全体リロードになった場合など）と、UI は先頭タブで始まり、Rust 側も先頭タブの表示に戻す
- 開発ビルドでは旧 Electron 版のアンインストール案内を出さない（開発機の Electron 版を消さないため）
- 開発ビルドのデータは `%APPDATA%\com.aibrowser.app`（WebView のデータは `%LOCALAPPDATA%\com.aibrowser.app`）。
  ここに appState.json が無いときは Electron 版の userData から読む
- 子 WebView の開発者ツールは、各サイト上の右クリックメニューから開ける（開発ビルドのみ）
- Claude Code デスクトップ版（Windows では MSIX パッケージ）のシェルから起動したプロセスは、AppData への書き込みが
  `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\` に仮想化され、そのシェルから見える AppData も仮想化後の内容になる。
  ユーザーの実データで動作を確かめるときは `explorer.exe <exe のパス>` で起動し、ファイルの確認も explorer 経由で起動したスクリプトで行う
- Linux 版は未対応（`docs/tauri-migration-plan.md` の Phase 7）

## リリースとコード署名

- Windows: Azure Key Vault + AzureSignTool。`.env` の `AZURE_KEY_VAULT_*` を使う。`sign-azure.ps1` は本体 exe と MSI だけを署名する
- macOS: `.env` の `DEVELOPER_ID_APP` / `APPLE_API_KEY_ID` / `APPLE_API_KEY_PATH` / `APPLE_API_ISSUER`
- アップデータ署名鍵 `.tauri/myapp.key` は git 管理外。紛失すると既存ユーザーに更新を届けられないのでバックアップする
- `.sha256` の GPG 署名（`.sha256.asc`）は `scripts/sign-artifacts.cjs` が作る。`gpg --batch` で署名するため、
  パスフレーズをキャッシュしていないと失敗して `.sha256` だけになる。Claude Code などのサンドボックスから起動した
  gpg-agent は pinentry を出せないので、事前にユーザー自身のターミナルで `echo test | gpg --clearsign --local-user <鍵> > /dev/null` を実行しておく
- 秘密鍵・パスフレーズ・`.env` は絶対にコミットしない
