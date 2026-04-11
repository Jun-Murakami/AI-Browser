# CLAUDE.md

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
- Electron 41 + electron-vite 6（ビルドツール）
- React 19 + TypeScript 6
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
- `node-pty@1.2.0-beta.12` はプリビルドバイナリを同梱しており、`electron-rebuild` は不要
- `electron.vite.config.ts` で `rollupOptions.external: ['node-pty']` を指定し、バンドルに含めず実行時に `node_modules` から読み込む
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

## ライセンス管理

Windowsビルド時は自動的にライセンスファイルが生成されます（`scripts/generate-licenses.js`）。新しい依存関係を追加した場合は、ビルドプロセスで自動的に更新されます。