# AI-Browser Tauri 移行計画

作業ブランチ: `tauri`（`main` から分岐）

## 目的

- Electron 版の機能をそのまま Tauri 2 に移す。見た目と操作は変えない。
- インストーラの小型化（100MB 超 → 10MB 台）とメモリ削減。
- 既存ユーザーは、Electron 版のアプリ内アップデータ経由で Tauri 版へ自動移行できるようにする。

## 方針

1. **同じリポジトリ・同じリリース置き場を使う。** 既存版は `Jun-Murakami/AI-Browser` の `releases/latest` しか見ないため。
2. **Electron 版は v1.7.2 で打ち止めにする（2026-11-05 決定）。** 以降の修正は Tauri 版にだけ入れ、`main` からのマージは行わない。
   Electron 版のコードは Phase 8 で撤去するまで残しているだけ。v1.7.2 の利用者は、Tauri 版を公開するまで Claude への送信などが直らない。
3. **レンダラーの変更は最小限。** 移行中は `window.electron` / `window.api` と同じ形の互換レイヤーを差し込み、コンポーネントはそのまま使った。
   Phase 8 で `src/renderer/src/services/bridge.ts`（`appBridge` / `terminalBridge`）を直接 import する形に整理した（メソッド名は Electron 版のまま）。
4. **送信スクリプトは TS のまま。** `src/shared/scripts/browserScripts.ts` をレンダラーで組み立て、文字列を Rust に渡して `eval` する。
5. 開発中のビルドは GitHub の **prerelease** として出す（`releases/latest` に載らないので既存ユーザーに届かない）。

## 構成

```
src-tauri/
  Cargo.toml          tauri = { features = ["unstable"] }（マルチ WebView 用）
  tauri.conf.json     version は ../package.json を参照
  capabilities/       IPC は UI 用 WebView（label: "ui"）だけに許可
  src/
    main.rs
    lib.rs            起動、ウィンドウ生成、コマンド登録
    state.rs          appState.json / logs.json の読み書きと検証・マイグレーション
    views.rs          AI サービスの子 WebView（生成・切替・リサイズ・送信）
    terminal.rs       portable-pty によるターミナル（Phase 3）
    keys.rs           表示中のタブへのキー送出（Phase 4）
    migrate.rs        Electron 版データの引き継ぎ（Phase 5）
    updater.rs        アプリ内アップデート（Phase 6）
src/renderer/src/services/bridge.ts   Rust とのやり取り（Phase 8 で互換レイヤーから整理）
src/shared/                           ブラウザ・ターミナルの定義と送信スクリプト
vite.config.ts                        レンダラーのビルド設定（出力: out/renderer）
```

（移行中は `src/renderer/src/tauri/electronCompat.ts` と `vite.tauri.config.ts` だった。以下の各フェーズの記述は当時のファイル名のまま残している）

### ウィンドウと WebView の配置

Electron（BrowserWindow + WebContentsView × 10）と同じ形にする。

- ウィンドウ `main` を WebView なしで作る（`tauri::window::WindowBuilder`）。
- その上に React UI の WebView `ui` を全面に置く（`auto_resize`）。
- AI サービスごとに子 WebView `svc-<ID>` を `Window::add_child` で重ねる。座標は Electron と同じ論理座標（x=0, y=108 起点）。
- タブ切替は `show()` / `hide()`、表示中タブのサイズは UI からの通知で `set_bounds()`。

### IPC の対応

| preload の API | Tauri |
|---|---|
| `getInitialSettings` | `init` コマンド（ブラウザ・ターミナル定義を渡し、状態の検証と子 WebView の生成もここで行う）。結果は互換レイヤーでキャッシュ |
| `sendBrowserSizeToMain` | `set_browser_size` |
| `sendBrowserTabIndexToMain` | `select_browser_tab`（-1 はターミナル） |
| `sendTextToMain` | `send_text`（全サービス分の組み立て済みスクリプトを渡し、送信先は Rust が判定） |
| `reloadCurrentView` / `reloadAllViews` | `reload_current_view` / `reload_all_views` |
| `openExternalLink` | `open_external_link`（http / https / mailto のみ） |
| `sendIsDarkModeToMain` ほか設定の保存系 | `update_state`（変更されたフィールドだけ送る） |
| `sendLogsToMain` | `set_logs` |
| `onUpdateUrls` / `onUpdateLoadingStatus` / `onScriptError` | イベント `update-urls` / `loading-status` / `script-error`（`ui` 宛てにだけ送る） |
| `onModKeyUp` | 不要（Tauri では UI の keyup が普通に届く）。互換レイヤーでは何もしない |
| `sendKeyToView` | Phase 4 |
| ターミナル系 (`window.api`) | Phase 3 |
| アップデート系 | Phase 6 |

## フェーズ

各フェーズの終わりに `npm run typecheck`、`npm run lint`、`cargo check` が通り、Electron 版（`npm run dev`）が壊れていないことを確認する。

### Phase 0: 土台

- [x] `@tauri-apps/cli`、`@tauri-apps/api` を追加
- [x] `src-tauri/` の雛形（Cargo.toml、tauri.conf.json、capabilities、アイコン。`.ico` / `.icns` は `build/` のものを流用）
- [x] `vite.tauri.config.ts`（electron.vite.config.ts の renderer 設定と同じプラグイン構成。CSP に Tauri の IPC 用の接続先を追加）
- [x] npm スクリプト `dev:tauri` / `build:tauri`（レンダラーだけは `dev:tauri-renderer` / `build:tauri-renderer`）
- [x] `src-tauri/.gitignore` で `target/` と `gen/schemas` を除外
- [x] `tsconfig.web.json` に `src/main/scripts/browserScripts.ts`、`tsconfig.node.json` に `vite.tauri.config.*` を追加

### Phase 1: マルチ WebView 基盤（試作の確認項目 1〜3）

実装は完了。下の「確認」は目視待ち。

- [x] ウィンドウ `main` + UI WebView `ui` + 子 WebView 10 枚（起動ログで 10 個の生成と全サービスの読み込み完了を確認）
- [x] 互換レイヤーと `init` / `set_browser_size` / `select_browser_tab`
- [x] ローディング状態と URL の通知（`on_page_load`）
- [x] テキスト送信（単体・一斉）とスクリプトエラーの通知（`eval_with_callback`）
- [x] リロード（現在のタブ・全タブ）
- [x] 状態の読み書き（appState.json / logs.json）、ウィンドウ位置・サイズ・最大化の復元、ダークモード。Tauri 側に無ければ Electron 版の userData から読む（Phase 5 の一部を先行実装、起動ログで確認）
- [x] 外部リンク。UI からの `window.open` とナビゲーションは外部ブラウザへ。AI サービスの `window.open` は OAuth のポップアップのため既定動作（許可）
- [x] 非表示タブのタイマー抑制対策（Windows: `additional_browser_args` に Chromium フラグ。全 WebView で同じ値にする）
- [x] 本番ビルドで Ctrl+R / F5 によるリロードを抑止

**確認:**
1. 10 枚の子 WebView、タブ切替、ウィンドウとスプリッタのリサイズ → OK
2. 非表示タブを含む一斉送信が全サービスで動く → OK（Claude と Kimi は下記の修正後に再確認が必要）
3. ChatGPT / Claude / Gemini / Grok にログインできる（Cloudflare、Google ログイン） → OK

**確認中に見つけて直したもの:**
- Claude の送信ボタンが見つからない。ツールチップが Radix から Base UI に変わり、`data-state="closed"` の div が無くなった。`button[data-testid="chat-input-send"]` を優先し、有効になるまで待って押すように変更（Electron 版にも効く）
- Kimi が kimi.com（中国向けログイン画面）から kimi.ai に移った。URL を `https://www.kimi.ai/`、パターンを `kimi.ai` / `kimi.com` に変更。送信ボタンも `disabled` クラスが外れるまで待つように変更（Electron 版にも効く）
- Tauri の async コマンドは呼び出し順に実行されるとは限らず、起動直後の一時的な小さい幅が保存済みの幅を上書きしてブラウザ側のペインが最小幅になった。互換レイヤーでコマンドを 1 本のキューで順に実行し、サイズ通知は init の完了後に最新値だけ送るように変更
- UI がリロードされると（開発中の HMR など）UI は先頭タブで始まるが、Rust 側は前のタブを表示したままだった。2 回目の init で表示を先頭タブに戻すように変更

### Phase 2: 細部の互換

- [ ] UI の MUI ダイアログと子 WebView の重なり（Electron と同じ挙動か）
- [ ] ズーム（Ctrl+ホイール）を Electron と揃える。今は `zoom_hotkeys_enabled` を指定しておらず、AI サイトでの Ctrl+ホイールのズームは無効
- [x] 右クリックメニュー：WebView2 の標準メニュー（戻る・更新・保存・印刷、開発ビルドでは開発者ツール）が出る
- [x] ダークモード切替が AI サイトの `prefers-color-scheme` に反映される（Claude で確認）

### Phase 3: ターミナル

- [x] `portable-pty` でセッション生成・入力・出力（16ms 単位でまとめて送る）・リサイズ・リロード・終了（`src-tauri/src/terminal.rs`）
- [x] シェルの選択（Windows: pwsh → powershell → cmd、mac/Linux: `$SHELL -l`）と環境変数
- [x] クリップボード画像の貼り付け（`arboard` で読み、PNG で一時保存してパスを返す）、終了時の掃除
- [x] 入力の順序を保つため、互換レイヤーでターミナルごとに 1 件ずつ送る（送信中に溜まった入力はまとめる）
- [x] UI の WebView で `enable_clipboard_access` を有効化（テキスト貼り付けの `navigator.clipboard.readText()` で確認ダイアログが出ていた）
- [x] 貼り付けが二重になる不具合を修正（`terminalService.ts`）。独自の貼り付け処理に加えて xterm 標準の貼り付けも動いていた。Electron 版でも同じことが起きていた可能性がある
- [x] exit で終了したターミナルをリロードで起動し直せるようにした（Electron 版はセッションが無いと何もしなかった）

**確認:** PowerShell 7 の起動、日本語の入出力、貼り付け（1 回だけ入る）、exit 時の `Process exited with code 0` → OK。クリップボード画像の貼り付けは未確認

### Phase 4: キー送出（試作の確認項目 4）

- [x] Windows: WebView2 の DevTools Protocol `Input.dispatchKeyEvent` で矢印・Enter・Backspace・Ctrl+キーを送る（`src-tauri/src/keys.rs`）
- [x] macOS / Linux: 暫定で JS の KeyboardEvent を送る（Enter で送信するサイトは動くが、キャレット移動などの既定動作は起きない）。Phase 7 で改善を検討
- 用途はテキスト送信直後の Enter（送信スクリプトが送信ボタンを押せなかったときの保険にもなっている）と、Ctrl+Alt+矢印 / Enter / Backspace のホットキー

### Phase 5: Electron 版からのデータ移行

- [x] appState.json / logs.json：Tauri 側に無ければ Electron の userData から読む（Phase 1 で先行実装）
- [x] Nani! の翻訳履歴（`src-tauri/src/migrate.rs`）：Electron の `Local Storage/leveldb` を一時フォルダにコピーし `rusty-leveldb` で開く。`_https://nani.now\0` で始まるキーのうち `dltbl:` を取り出し（先頭 1 バイトが 0 なら UTF-16LE、1 なら Latin-1）、Nani! の読み込み完了後に `localStorage` へ未設定のキーだけ書き込んでリロード。完了フラグは appState の `naniMigrated`
- [x] `cuser` は移さない。ログイン情報らしく、Cookie を移せない以上、古い情報が残るだけのため。`dltbl:` だけで履歴が表示されることを確認した

**確認:** 開発機で Electron 版の履歴 22 件を読み出して書き込み、Nani! の履歴一覧に表示されることを確認 → OK

### Phase 6: アップデータとリリース

DialogSuite と同じ仕組み（ローカルのビルドスクリプト、minisign の `.tauri/myapp.key`、Azure Key Vault の `signCommand`、
Windows は MSI のみ）にし、配布先だけ Firebase Hosting ではなく GitHub Releases にした（OSS のため）。手順は `docs/tauri-release.md`。

- [x] tauri-plugin-updater（`src-tauri/src/updater.rs`）。`latest.json` は GitHub Releases の最新リリースに添付し、
  `releases/latest/download/latest.json` から読む。既存の UpdateDialog は互換レイヤー経由でそのまま使う
- [x] 署名鍵 `.tauri/myapp.key` を作成（パスワード無し、git 管理外）。公開鍵は `tauri.conf.json`
- [x] Windows のコード署名: `src-tauri/sign-azure.ps1`（許可リスト方式）。認証情報は Electron 版と同じ `.env` の `AZURE_KEY_VAULT_*`
- [x] `build_windows_release.ps1` / `build_macos.zsh` / `scripts/release-manifest.mjs`。成果物は `release/` に集め、
  `gh` で下書きのリリースとしてアップロードする（公開は手動）
- [x] 成果物の名前を Electron 版のアップデータが拾える形に揃える（`AI-Browser-<v>-setup_win_x64.msi`、`AI-Browser-<v>_mac_universal.dmg` と `.sha256`）。
  macOS は Electron 版と同じく Universal
- [x] Windows: Tauri 版の初回起動時に旧 Electron 版のアンインストールを 1 度だけ尋ねる（MSI はマシン単位、旧版はユーザー単位の NSIS で、両方残るため）。
  開発ビルドでは尋ねない。旧版のアンインストーラはインストール先のパスで実行中のプロセスを探すので、Program Files にある Tauri 版は終了させられない
- [ ] Linux（AppImage / deb）は Phase 7
- [ ] prerelease で配布して確認 → v2.0.0 を通常リリース

**確認:** `build_windows_release.ps1` を署名ありで実行 → 本体 exe と MSI を Azure Key Vault で署名（MSI 内の exe も `Valid`）、
アップデータ署名（.sig）、`release/` への配置、`.sha256`、`latest.json` まで OK（アップロードはしていない）。MSI は 9.98 MiB。
アプリ内アップデートと旧版のアンインストールの案内は、リリースを出すまで実地では確認できない

### Phase 7: macOS / Linux 検証

- [ ] WKWebView（macOS）で全サービスの送信スクリプトを確認し、必要なら修正
- [ ] Google ログインが弾かれる場合は User-Agent を調整
- [ ] WebKitGTK（Linux）の動作確認。問題が大きければ Linux だけ Electron 版を残すか、Tauri 3 の CEF ランタイムを待つかを判断

### Phase 8: Electron の撤去と整理

Electron 版を打ち止めにしたので、`main` との共存を気にせずいつでも進められる。
ただし、リリース成果物の名前を Electron 版のアップデータに合わせる決まり（`docs/tauri-release.md`）は、移行が済むまで残す。


- [x] `src/main`、`src/preload`、`electron.vite.config.ts`、`electron-builder.yml`、`dev-app-update.yml`、`build/`、
  Electron 専用のスクリプト（`run-builder.cjs` / `sign-win.cjs` / `fix-pty-module.cjs`）、`.vscode/launch.json` を削除。
  Electron 関連の npm パッケージ（electron、electron-vite、electron-builder、@electron-toolkit/*、electron-context-menu、node-pty）を削除
- [x] 互換レイヤーを `services/bridge.ts` に整理し、`window.electron` / `window.api` をやめて import する形にした。
  Electron 専用だった `onModKeyUp` と、更新時のインストーラ / `.sha256` の URL の受け渡しを削除
- [x] 送信スクリプトを `src/shared/scripts/` へ、元アイコンを `app-icon.png`（`tauri icon` の既定の入力）へ移動
- [x] Vite の設定を `vite.config.ts`（開発サーバーは 1420、出力は `out/renderer`）に、tsconfig を @electron-toolkit に依存しない形に
- [x] OSS としてビルドしやすいよう、アップデータ用ファイルの生成はリリーススクリプトの `--config` で有効にし、
  Windows の署名コマンドも `tauri.conf.json` から外してリリーススクリプトが絶対パスで付ける（`npm run build` で署名なしのインストーラを作れる）。
  当初は `tauri.conf.json` に相対パス（`src-tauri/sign-azure.ps1`）で書いていたが、素の `tauri build` では見つからず失敗していた
- [x] AGENTS.md / README / `.cursor/rules` を Tauri 版の内容に更新

## 既知のリスクと決めごと

- マルチ WebView は Tauri 2.12 時点でも `unstable` フィーチャー。破壊的変更に備えて Tauri のバージョンは固定し、上げるときは動作確認する。
- Windows では同期コマンド内で WebView を作るとデッドロックするため、WebView を作るコマンドは `async` にする。
- `additional_browser_args` を使うと Tauri の既定値（`--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`）が置き換わるので、既定値も含めて指定する。
- `identifier` は Electron の `appId` と同じ `com.aibrowser.app` にする（macOS での同一アプリ扱いのため）。Tauri CLI は末尾 `.app` に警告を出すが、動作には影響しない想定。問題が出たら見直す。
- AI サービスのログイン状態（Cookie）は引き継げない。リリースノートで再ログインをお願いする。
