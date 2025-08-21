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
  - `theme/` - MUIテーマ設定
- `src/preload/` - プリロードスクリプト（セキュアなブリッジ）

### 主要な技術スタック
- Electron 37.3.1
- React 19.1.1 + TypeScript 5.9.2
- Material-UI（UIコンポーネント）
- Monaco Editor（コードエディタ機能）
- Vite 7.1.3（ビルドツール）
- Biome（リンター・フォーマッター）

### 重要な設計パターン
1. **マルチWebView アーキテクチャ**: 各AIサービスは独立したWebContentsViewで動作
2. **IPCによる通信**: メインプロセスとレンダラープロセス間の安全な通信
3. **タブシステム**: 複数のAIサービスを効率的に管理
4. **Monaco Editor統合**: シンタックスハイライト付きのコード編集機能
5. **分割エディタビュー**: 最大5分割までの柔軟なレイアウト

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
- `biome.json` - コード品質設定
- `src/main/index.ts` - メインプロセスのエントリーポイント
- `src/renderer/src/App.tsx` - Reactアプリのルートコンポーネント
- `src/preload/index.ts` - プリロードスクリプト

## ライセンス管理

Windowsビルド時は自動的にライセンスファイルが生成されます（`scripts/generate-licenses.js`）。新しい依存関係を追加した場合は、ビルドプロセスで自動的に更新されます。