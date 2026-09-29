# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要な指示

**このリポジトリで作業する際は、必ず日本語で回答してください。**

## プロジェクト概要

AI Browserは、複数のAIチャットサービス（ChatGPT、Claude、Gemini等）を統合したElectronベースのデスクトップアプリケーションです。各AIサービスは独立したWebContentsViewで動作し、タブシステムで管理されています。

## 開発コマンド

```bash
# 開発モード起動
npm run dev

# React DevTools（スタンドアロン版、別ターミナルで実行）
npm run devtools

# コード品質チェック
npm run lint          # Biomeによるリントチェック
npm run lint:fix      # リントエラーの自動修正
npm run format        # コードフォーマット
npm run typecheck     # TypeScript型チェック

# ビルド
npm run build         # 全プラットフォーム向けビルド
npm run build:win     # Windows向けビルド（ライセンス生成含む）
npm run build:mac     # macOS向けビルド
npm run build:linux   # Linux向けビルド

# ビルド済みアプリのプレビュー
npm start
```

## アーキテクチャ構造

### ディレクトリ構成
- `src/main/` - メインプロセス（ウィンドウ管理、IPC通信、ブラウザタブ管理）
- `src/renderer/` - レンダラープロセス（React + Material-UI）
  - `components/` - Reactコンポーネント
  - `hooks/` - カスタムReactフック
  - `stores/` - Zustand ストア（グローバル状態管理）
  - `theme/` - MUIテーマ設定
- `src/preload/` - プリロードスクリプト（セキュアなブリッジ）

### 主要な技術スタック
- Electron 44 + electron-vite 6 beta（ビルドツール）
- React 19 + TypeScript 7（ネイティブ版 tsc）
- Material-UI 9（UIコンポーネント）
- Monaco Editor（コードエディタ機能）
- Zustand（グローバル状態管理）
- Biome（リンター・フォーマッター）
- node-pty 1.2.0-beta（ターミナル機能、ConPTY + N-API、プリビルドバイナリ同梱）

### 重要な設計パターン
1. **マルチWebView アーキテクチャ**: 各AIサービスは独立したWebContentsViewで動作
2. **IPCによる通信**: メインプロセスとレンダラープロセス間の安全な通信
3. **タブシステム**: 複数のAIサービスを効率的に管理
4. **Monaco Editor統合**: シンタックスハイライト付きのコード編集機能
5. **分割エディタビュー**: 最大5分割までの柔軟なレイアウト
6. **Zustand による状態管理**: エディタ値やブラウザ読み込み状態など、コンポーネント横断の状態をストアで管理。個別セレクタで不要な再レンダリングを防止

### 状態管理（Zustand）
- `stores/useEditorStore.ts` - エディタ値の管理（5つの分割エディタの値）
- `stores/useBrowserLoadingStore.ts` - ブラウザタブの読み込み状態
- ストアの値を取得する際は、必ず個別セレクタを使用すること（例: `useEditorStore((s) => s.editorValues[0])`）。オブジェクト全体を取得すると不要な再レンダリングが発生する
- 段階的にストア化を進行中。現在はエディタ値とブラウザ読み込み状態のみ。タブ管理・ログ管理は従来のカスタムフック（`useTabManager`, `useLogManager`）で管理

### ネイティブモジュール（node-pty）
- `node-pty@1.2.0-beta.15` はプリビルドバイナリを同梱しており、`electron-rebuild` は不要（npm の `latest` タグの 1.1.0 は linux プリビルドが無いので移行しない）
- `electron.vite.config.ts` で `rolldownOptions.external: ['node-pty']` を指定し、バンドルに含めず実行時に `node_modules` から読み込む
- electron-vite 6 は main/preload の依存を既定で外部化する。sandbox 付き preload は `electron` 以外を require できないため、preload は `externalizeDeps: false` でバンドルする
- `scripts/fix-pty-module.cjs` は postinstall でプリビルドの存在確認を行う

### React DevTools
- `react-devtools`（スタンドアロン版）を devDependencies に含む
- `src/renderer/index.html` に `http://localhost:8097` への接続スクリプトと CSP 設定を追加済み
- 使い方: ターミナル1で `npm run devtools`、ターミナル2で `npm run dev`

## 開発時の注意事項

### コードスタイル
- インデント: スペース2つ
- 文字列: シングルクォート使用
- Biome設定に従ったフォーマット必須
- TypeScriptの厳格な型チェック有効

### パスエイリアス
- `@renderer/*` - レンダラープロセスのソースコード
- `@/*` - レンダラープロセスのルート

### セキュリティ
- Context Isolationを使用
- プリロードスクリプトで必要最小限のAPIのみ公開
- 外部リンクは別ウィンドウで開く

### 現在の制限事項
- テストフレームワークが未設定
- CI/CDパイプラインが未構築
- 自動依存関係更新が未設定

## よく使用するファイル

- `electron-builder.yml` - ビルド設定
- `electron.vite.config.ts` - Viteビルド設定（node-ptyの外部化設定含む）
- `biome.json` - コード品質設定
- `src/main/index.ts` - メインプロセスのエントリーポイント
- `src/renderer/src/App.tsx` - Reactアプリのルートコンポーネント
- `src/renderer/src/stores/` - Zustand ストア
- `src/preload/index.ts` - プリロードスクリプト

## Linux ビルド（macOS からのクロスビルド）

Apple Silicon の macOS から `npm run build:linux` で x64 の AppImage / deb を生成できる（Docker・WSL・実機 Linux は不要）。

- `npmRebuild: false` かつ node-pty 同梱のプリビルドを使うためネイティブコンパイルが無く、成果物の互換性はビルドホストに依存しない（Electron 本体が glibc 2.25 以上、node-pty が glibc 2.28 以上を要求）
- deb 用の fpm や AppImage のツールは electron-builder が自動でダウンロードする
- `electron-builder.yml` の linux target は `arch: x64` に固定している。arch を省略するとホストの arch（arm64）でビルドされ、`_linux_amd64` という名前で arm64 バイナリが出力されてしまうので外さないこと
- Windows ネイティブでは deb を作れない（fpm が動かない）。WSL2 でも可能だが、WSL 内の ext4 に clone して `npm ci` する必要がある
- 成果物: `dist/ai-browser-<version>_linux_amd64.{AppImage,deb}` と、それぞれの `.sha256` / `.sha256.asc`、`latest-linux.yml`

### チェックサムと GPG 署名

`scripts/sign-artifacts.cjs`（electron-builder の `afterAllArtifactBuild`）が成果物ごとに `.sha256` と、その GPG デタッチ署名 `.sha256.asc` を生成する。

- アプリ内アップデートの検証は `.sha256` のみを使う（無いと更新を中止する）。`.sha256.asc` は利用者が手動で真正性を確認するためのもの（README の「Verifying Downloads (Linux)」）
- gpg が無い、または `.env` で `SKIP_GPG_SIGN=true` の場合は署名をスキップし、`.sha256` のみ生成する
- 署名には**秘密鍵**が必要。リポジトリ直下の `ai-browser-public-key.asc` は検証用の公開鍵で、署名には使えない。秘密鍵・失効証明書・パスフレーズはリポジトリ外で管理し、絶対にコミットしない

初回セットアップ（macOS）:

```bash
brew install gnupg pinentry-mac
# ~/.gnupg/gpg-agent.conf に次の1行を書く（パスフレーズを macOS のダイアログで入力するため）
#   pinentry-program /opt/homebrew/bin/pinentry-mac
gpg --import <秘密鍵のエクスポートファイル>
```

- `.env` の `GPG_SIGNING_KEY` に署名鍵のメールアドレスかフィンガープリントを設定する（`.env` はコミットしない）

ビルド手順:

```bash
# 1. パスフレーズをキャッシュする（ユーザー自身のターミナルで実行）
echo test | gpg --clearsign --local-user <GPG_SIGNING_KEY の値> > /dev/null
# 2. ビルド（license.json の再生成、型チェック、ビルド、パッケージング、署名）
npm run build:linux
# 3. 検証
gpg --verify dist/<成果物>.sha256.asc dist/<成果物>.sha256
(cd dist && shasum -a 256 -c <成果物>.sha256)
```

- 署名は `gpg --batch` で行うため、パスフレーズがキャッシュされていないと失敗し、`.sha256` のみになる（警告が出る）
- Claude Code などのサンドボックス化されたシェルから起動した gpg-agent は pinentry のダイアログを表示できず、「操作がキャンセルされました」で失敗する。手順1はユーザー自身のターミナルで実行し、agent をそこで起動させること

## ライセンス管理

Windowsビルド時は自動的にライセンスファイルが生成されます（`scripts/generate-licenses.js`）。新しい依存関係を追加した場合は、ビルドプロセスで自動的に更新されます。