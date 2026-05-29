#!/usr/bin/env node

/**
 * electron-builder 起動ラッパー。
 *
 * 目的:
 *   - ルートの .env を process.env に読み込む（OS非依存。bash の inline export に依存しない）
 *   - .env の変数名を electron-builder が期待する名前へマッピングする
 *   - 渡された引数（--win / --mac / --linux 等）をそのまま electron-builder に委譲する
 *
 * macOS 公証（API キー方式）で electron-builder / notarytool が参照する環境変数:
 *   APPLE_API_KEY      … AuthKey_XXXX.p8 へのパス
 *   APPLE_API_KEY_ID   … キー ID（10文字）
 *   APPLE_API_ISSUER   … Issuer UUID
 *
 * このリポジトリは旧 build:mac との互換のため、シェル / .env 側で次の命名を使う:
 *   APPLE_API_KEY       = Key ID
 *   APPLE_API_KEY_PATH  = .p8 ファイルへのパス
 *   APPLE_API_ISSUER    = Issuer UUID（そのまま使える）
 * 旧スクリプトは inline で `APPLE_API_KEY_ID="$APPLE_API_KEY" APPLE_API_KEY="$APPLE_API_KEY_PATH"`
 * のように remap していた。ここでは同じ remap を Node 上で行う。
 *
 * 判定: APPLE_API_KEY_PATH が存在すれば「旧式命名」と判定し、無条件に remap する。
 * これにより、.env でも シェル export でも、どちらで指定しても同じ結果になる。
 * モダンな命名（APPLE_API_KEY に直接 .p8 パスを入れる）で運用したい場合は、
 * APPLE_API_KEY_PATH を設定せず APPLE_API_KEY / APPLE_API_KEY_ID を直接指定すればよい。
 *
 * macOS 署名 ID（任意。未指定なら electron-builder が keychain から自動選択）:
 *   CSC_NAME           ← .env / シェル: DEVELOPER_ID_APP
 *
 * Windows(Azure) / Linux(GPG) の鍵情報は各 sign フック側で .env を読むため
 * ここでのマッピングは不要。
 */

const path = require('node:path');
const { spawn } = require('node:child_process');
const { loadDotEnv } = require(path.join(__dirname, 'load-env.cjs'));

loadDotEnv();

// 旧式命名（APPLE_API_KEY=KeyID, APPLE_API_KEY_PATH=.p8 path）を検知して remap。
// APPLE_API_KEY_PATH が定義されていることをトリガにする。スナップショットを取って
// APPLE_API_KEY を APPLE_API_KEY_ID へ救出してから、APPLE_API_KEY を上書きする。
if (process.env.APPLE_API_KEY_PATH) {
  const legacyApiKey = process.env.APPLE_API_KEY; // = Key ID（旧式命名）
  const apiKeyPath = process.env.APPLE_API_KEY_PATH;

  if (legacyApiKey && !process.env.APPLE_API_KEY_ID) {
    process.env.APPLE_API_KEY_ID = legacyApiKey;
  }
  process.env.APPLE_API_KEY = apiKeyPath;
}

// DEVELOPER_ID_APP → CSC_NAME（既に CSC_NAME 指定がある場合は温存）
if (!process.env.CSC_NAME && process.env.DEVELOPER_ID_APP) {
  process.env.CSC_NAME = process.env.DEVELOPER_ID_APP;
}

// electron-builder 26 以降は CSC_NAME に "Developer ID Application:" プレフィックスを
// 含めると `Please remove prefix "Developer ID Application:" from the specified name`
// で停止する。.env に証明書の Common Name をフル文字列で書いてあっても通るよう、
// ここでプレフィックスを除去する（プレフィックス無しの値はそのまま通る）。
if (process.env.CSC_NAME) {
  const stripped = process.env.CSC_NAME.replace(
    /^\s*Developer ID Application:\s*/i,
    '',
  ).trim();
  if (stripped) {
    process.env.CSC_NAME = stripped;
  } else {
    // 中身が空になる（= 値がプレフィックスだけだった）なら、未指定扱いにして
    // electron-builder の keychain 自動選択に任せる。
    delete process.env.CSC_NAME;
  }
}

const args = process.argv.slice(2);

// electron-builder の CLI を Node で直接起動する（shell を介さない＝OS差異・
// 引数エスケープ問題を回避）。bin パスは electron-builder パッケージから解決する。
const ebPkg = require.resolve('electron-builder/package.json');
const ebBin = require('electron-builder/package.json').bin['electron-builder'];
const ebCli = path.join(path.dirname(ebPkg), ebBin);

const child = spawn(process.execPath, [ebCli, ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
child.on('error', (err) => {
  console.error('[run-builder] failed to launch electron-builder:', err);
  process.exit(1);
});
