#!/usr/bin/env node

/**
 * electron-builder 起動ラッパー。
 *
 * 目的:
 *   - ルートの .env を process.env に読み込む（OS非依存。bash の inline export に依存しない）
 *   - .env の変数名を electron-builder が期待する名前へマッピングする
 *   - 渡された引数（--win / --mac / --linux 等）をそのまま electron-builder に委譲する
 *
 * macOS 公証（API キー方式）で electron-builder が参照する環境変数:
 *   APPLE_API_KEY      … AuthKey_XXXX.p8 へのパス   ← .env: APPLE_API_KEY_PATH
 *   APPLE_API_KEY_ID   … キー ID                    ← .env: APPLE_API_KEY_ID
 *   APPLE_API_ISSUER   … Issuer UUID                ← .env: APPLE_API_ISSUER
 *
 * macOS 署名 ID（任意。未指定なら electron-builder が keychain から自動選択）:
 *   CSC_NAME           ← .env: DEVELOPER_ID_APP
 *
 * Windows(Azure) / Linux(GPG) の鍵情報は各 sign フック側で .env を読むため
 * ここでのマッピングは不要。
 */

const path = require('node:path');
const { spawn } = require('node:child_process');
const { loadDotEnv } = require(path.join(__dirname, 'load-env.cjs'));

loadDotEnv();

// .env の名前 → electron-builder が期待する名前（既存の env は上書きしない）
const ALIASES = {
  APPLE_API_KEY: 'APPLE_API_KEY_PATH',
  CSC_NAME: 'DEVELOPER_ID_APP',
};
for (const [target, source] of Object.entries(ALIASES)) {
  if (!process.env[target] && process.env[source]) {
    process.env[target] = process.env[source];
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
